import { Outlet } from "react-router";

export default function DevelopersPageLayout() {
  return (
    <div className="max-w-3xl mx-auto w-full py-4">
      <Outlet />
    </div>
  );
}
