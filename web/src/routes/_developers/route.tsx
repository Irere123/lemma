import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export const Route = createFileRoute("/_developers")({
  component: RouteComponent,
  head: async () => {
    return {
      meta: [
        {
          title: "Developers Portal",
        },
      ],
    };
  },
});

function RouteComponent() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="w-full">
        <AppHeader />
        <Outlet />
      </div>
    </SidebarProvider>
  );
}
