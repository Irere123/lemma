// Server-side tRPC utilities for TanStack Start
// Only import this file in server-side contexts (loaders, server components)

import type { AppRouter } from "@brain/api";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { createTRPCClient, loggerLink } from "@trpc/client";
import { httpBatchLink } from "@trpc/client/links/httpBatchLink";
import { cache } from "react";
import superjson from "superjson";

import { makeQueryClient } from "./query-client";

// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
// This ensures no data leakage between requests.
export const getQueryClient = cache(makeQueryClient);

/**
 * Create a tRPC client with request cookies for authentication
 * This forwards cookies from the incoming request to the backend API
 */
export function createAuthenticatedTRPCClient(request?: Request) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/trpc`,
        transformer: superjson,
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
            headers: {
              ...options?.headers,
              // Forward cookies from the incoming request
              ...(request?.headers.get("cookie")
                ? { cookie: request.headers.get("cookie")! }
                : {}),
            },
          });
        },
      }),
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === "development" ||
          (opts.direction === "down" && opts.result instanceof Error),
      }),
    ],
  });
}

/**
 * Hydration boundary component that dehydrates the query client state
 * to be used on the client. Wrap your app with this component.
 */
export function HydrateClient(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {props.children}
    </HydrationBoundary>
  );
}

/**
 * Prefetch data using tRPC and populate the query cache
 * This is the recommended approach for TanStack Start loaders
 *
 * Usage in loader:
 * ```ts
 * loader: async ({ context }) => {
 *   await serverPrefetch({
 *     request: context.request,
 *     queryKey: ['documents', 'getDocumentById', { id: docId }],
 *     fetchFn: (client) => client.documents.getDocumentById.query({ id: docId })
 *   })
 * }
 * ```
 */
export async function serverPrefetch<TData>({
  request,
  queryKey,
  fetchFn,
}: {
  request?: Request;
  queryKey: unknown[];
  fetchFn: (
    client: ReturnType<typeof createAuthenticatedTRPCClient>
  ) => Promise<TData>;
}) {
  const queryClient = getQueryClient();
  const trpcClient = createAuthenticatedTRPCClient(request);

  try {
    // If this route likely requires auth and no cookies are present, skip silently
    const cookie = request?.headers.get("cookie");
    if (!cookie) {
      return null;
    }
    // Fetch data using the authenticated tRPC client
    const data = await fetchFn(trpcClient);

    // Manually populate the query cache
    queryClient.setQueryData(queryKey, data);

    return data;
  } catch (_error) {
    // Don't throw - let the client handle the error
    return null;
  }
}
