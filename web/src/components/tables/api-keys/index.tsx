import { useSuspenseQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { useApiKeysModalStore } from "@/stores/api-keys-modal";
import { useTRPC } from "@/trpc/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { columns } from "./columns";
import { EmptyState } from "./empty-state";

export function DataTable() {
  const trpc = useTRPC();
  const { setData } = useApiKeysModalStore();
  const { data } = useSuspenseQuery({
    ...trpc.apiKeys.get.queryOptions(),
  });

  const table = useReactTable({
    getRowId: (row) => row.id,
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      {data.length > 0 ? (
        <Table className="border border-border">
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className={"text-right"}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-transparent">
                {row.getAllCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    onClick={() => {
                      if (cell.column.id !== "actions") {
                        setData(row.original, "edit");
                      }
                    }}
                    className={cn(
                      "border-r-[0px] py-4 cursor-pointer text-right"
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState />
      )}
    </>
  );
}
