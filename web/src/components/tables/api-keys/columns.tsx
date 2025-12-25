import type { ColumnDef } from "@tanstack/react-table";
import { IconDots } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";

import type { RouterOutputs } from "@api/trpc/routers/_app";
import { scopesToName } from "@lemma/common/scopes";
import { useApiKeysModalStore } from "@/stores/api-keys-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ApiKey = RouterOutputs["apiKeys"]["get"][number];

export const columns: ColumnDef<ApiKey>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      return row.original.name;
    },
  },

  {
    id: "scopes",
    accessorKey: "scopes",
    header: "Permissions",
    cell: ({ row }) => {
      return <Badge>{scopesToName(row.original.scopes).name}</Badge>;
    },
  },
  {
    id: "created",
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      const createdAt = row.original.createdAt;

      if (!createdAt) {
        return <span className="text-muted-foreground">-</span>;
      }

      return (
        <span>
          {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
        </span>
      );
    },
  },
  {
    id: "lastUsed",
    accessorKey: "lastUsedAt",
    header: "Last used",
    meta: {
      className: "border-r-[0px]",
    },
    cell: ({ row }) => {
      const lastUsedAt = row.original.lastUsedAt;

      if (!lastUsedAt) {
        return <span className="text-muted-foreground">Never</span>;
      }

      return (
        <span>
          {formatDistanceToNow(new Date(lastUsedAt), { addSuffix: true })}
        </span>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const { setData } = useApiKeysModalStore();

      return (
        <div className="flex justify-end">
          <div className="flex space-x-2 items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost">
                  <IconDots />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent sideOffset={10} align="end">
                <DropdownMenuItem onClick={() => setData(row.original, "edit")}>
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setData(row.original, "delete")}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      );
    },
    meta: {
      className: "text-right",
    },
  },
];
