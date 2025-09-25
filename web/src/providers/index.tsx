import { TRPCReactProvider } from "@/trpc/client";
import { HydrateClient } from "@/trpc/server";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <HydrateClient>{children}</HydrateClient>
    </TRPCReactProvider>
  );
}
