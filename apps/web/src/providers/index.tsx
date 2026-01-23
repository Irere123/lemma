import { TooltipProvider } from '@/components/ui/tooltip'
import { TRPCReactProvider } from '@/trpc/client'
import { HydrateClient } from '@/trpc/server'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <HydrateClient>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </HydrateClient>
    </TRPCReactProvider>
  )
}
