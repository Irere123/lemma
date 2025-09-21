import { useNProgress } from "@/hooks/use-nprogress";
import { TRPCReactProvider } from "@/trpc/client";
import { HydrateClient } from "@/trpc/server";

export function Providers({ children }: { children: React.ReactNode }) {
  useNProgress();
  return (
    <TRPCReactProvider>
      <HydrateClient>{children}</HydrateClient>
    </TRPCReactProvider>
  );
}
