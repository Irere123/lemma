import type { MiddlewareHandler } from "hono";
import { getSessionCookie } from "better-auth/cookies";
import { HTTPException } from "hono/http-exception";

import { createAuth } from "@api/lib/auth";
import { isValidApiKeyFormat } from "@api/db/utils/api-keys";
import { hash } from "@api/encryption";
import {
  getUserById,
  getApiKeyByToken,
  updatedApiKeyLastUsedAt,
  type ApiKey,
} from "@api/db/queries";
import { apiKeyCache } from "@api/cache/api-keys-cache";
import { userCache } from "@api/cache/user-cache";
import { expandScopes } from "@brain/common/scopes";

export const withAuth: MiddlewareHandler = async (c, next) => {
  const sessionCookie = getSessionCookie(c.req.raw.headers, {
    cookiePrefix: "brain",
  });
  const authHeader = c.req.header("Authorization");

  if (sessionCookie) {
    const auth = createAuth();

    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session || !session.user) {
      throw new HTTPException(401, {
        message: "Not authenticated",
      });
    }

    c.set("session", session);
    c.set("scopes", expandScopes(["apis.all"]));

    await next();
    return;
  }

  if (!authHeader) {
    throw new HTTPException(401, { message: "Authorization header required" });
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer") {
    throw new HTTPException(401, { message: "Invalid authorization scheme" });
  }

  if (!token) {
    throw new HTTPException(401, { message: "Token required" });
  }

  // Handle API keys (start with brain_ but not brain_access_token_)
  if (!token.startsWith("brain_") || !isValidApiKeyFormat(token)) {
    throw new HTTPException(401, { message: "Invalid token format" });
  }

  const db = c.get("db");

  const keyHash = hash(token);

  // Check cache first for API key
  let apiKey = JSON.parse((await apiKeyCache.get(keyHash)) as string);

  if (!apiKey) {
    // If not cache, query database
    apiKey = await getApiKeyByToken(db, keyHash);
    if (apiKey) {
      // Store in cache for future requests
      await apiKeyCache.set(keyHash, apiKey);
    }
  }

  if (!apiKey) {
    throw new HTTPException(401, { message: "Invalid API key" });
  }

  // Check cache first for user
  let user = JSON.parse((await userCache.get(apiKey.userId)) as string);

  if (!user) {
    // If not cache, query database
    user = await getUserById(db, apiKey.userId);
    if (user) {
      // Store in cache for future requests
      await userCache.set(apiKey.userId, user);
    }
  }

  if (!user) {
    throw new HTTPException(401, { message: "User not found" });
  }

  const session = {
    user: {
      id: user.id,
      email: user.email,
      image: user.image,
    },
  };

  c.set("session", session);
  c.set("scopes", expandScopes(apiKey.scopes ?? []));

  // Update last used at
  updatedApiKeyLastUsedAt(db, apiKey.id);

  await next();
};
