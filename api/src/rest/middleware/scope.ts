import type { Scope } from "@lemma/common/scopes";
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

export const withRequiredScope = (
  ...requiredScopes: Scope[]
): MiddlewareHandler => {
  return async (c, next) => {
    const scopes = c.get("scopes") as Scope[] | undefined;

    if (!scopes) {
      throw new HTTPException(401, {
        message: "No scopes found for the current user. Authentication is required.",
      });
    }

    // Check if user has at least one of the required scopes
    const hasRequiredScope = requiredScopes.some((requiredScope) =>
      scopes.includes(requiredScope)
    );

    if (!hasRequiredScope) {
      throw new HTTPException(403, {
        message: `Insufficient permissions. Required scopes: ${requiredScopes.join(",")}. Your scopes: ${scopes.join(", ")}`,
      });
    }

    await next();
  };
};
