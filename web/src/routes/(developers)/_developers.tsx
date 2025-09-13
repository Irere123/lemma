import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/(developers)/_developers")({
  component: DevelopersPageLayout,
});

function DevelopersPageLayout() {
  return (
    <div className="max-w-3xl mx-auto w-full py-4">
      <Outlet />
    </div>
  );
}
