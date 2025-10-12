import { TRPCReactProvider } from "@/trpc/client";
import { HydrateClient } from "@/trpc/server";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <HydrateClient>
        {children}
        <Toaster />
      </HydrateClient>
    </TRPCReactProvider>
  );
}
