import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we want to set a default staleTime to avoid refetching immediately on the client
        staleTime: 60 * 1000, // 1 minute
        // Reduce the default retry count for better performance
        retry: 1,
        // Enable refetch on window focus for better data freshness
        refetchOnWindowFocus: true,
        // Prevent unnecessary refetches on mount if data is fresh
        refetchOnMount: false,
      },
      mutations: {
        // Global error handling for mutations
        onError: (error) => {
          console.error("Mutation error:", error);
        },
      },
      dehydrate: {
        serializeData: superjson.serialize,
        // Include pending queries in dehydration for streaming support
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
