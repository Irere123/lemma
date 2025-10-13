import { Skeleton } from "@/components/ui/skeleton";

export function DocumentsSkeleton() {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Header section */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-24" />
        <div className="flex justify-between">
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      {/* Documents list */}
      <div className="border border-border border-dashed py-3 px-4 rounded-md">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex justify-between items-center py-4 border-b last:border-b-0"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-5 w-48" />
                {index % 3 === 0 && (
                  <Skeleton className="h-5 w-20 rounded-full" />
                )}
              </div>

              {index % 2 === 0 && <Skeleton className="h-4 w-64 mb-1" />}

              {index % 3 === 0 && <Skeleton className="h-3 w-40" />}
            </div>

            <div className="flex items-center space-x-3">
              <Skeleton className="h-4 w-20" /> {/* Date */}
              <Skeleton className="h-6 w-16 rounded-full" />{" "}
              {index % 4 === 0 && <Skeleton className="h-4 w-16" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
