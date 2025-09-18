import { IconEdit, IconSettings } from "@tabler/icons-react";
import { SidebarTrigger, useSidebar } from "./ui/sidebar";
import { Link } from "react-router";

export function AppHeader() {
  const { open } = useSidebar();
  return (
    <div className="py-2 px-3 flex gap-3">
      <SidebarTrigger />
      {!open && (
        <div className="flex gap-2 items-center">
          <Link to={`/documents`}>
            <IconSettings size={20} />
          </Link>
          <Link to={`/new`}>
            <IconEdit size={20} />
          </Link>
        </div>
      )}
    </div>
  );
}
