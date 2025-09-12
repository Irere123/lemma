import { useNProgress } from "@/hooks/use-nprogress";
import { TRPCReactProvider } from "@/trpc/client";

export function Providers({ children }: { children: React.ReactNode }) {
  useNProgress();
  return <TRPCReactProvider>{children}</TRPCReactProvider>;
}
