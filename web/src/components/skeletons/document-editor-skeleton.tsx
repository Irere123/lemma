import { Skeleton } from "@/components/ui/skeleton";

export function DocumentEditorSkeleton() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden relative">
      {/* Editor Header Skeleton */}
      <div className="w-full flex justify-between px-8 pt-4 pb-2 md:px-12">
        {/* Left side - Status and sync indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {/* Status badge skeleton */}
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>

            {/* Sync Status Indicator skeleton */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20" /> {/* Publish/Unpublish button */}
          <Skeleton className="h-9 w-9" /> {/* Settings button */}
          <Skeleton className="h-9 w-9" /> {/* More dropdown */}
        </div>
      </div>

      {/* Main content area */}
      <div className="mx-auto flex w-full flex-1 flex-col md:w-128 lg:w-160 xl:w-192">
        {/* Title and Subtitle Skeleton */}
        <div className="px-8 pt-4 pb-1 md:px-12 md:pt-8">
          {/* Title skeleton */}
          <Skeleton className="h-10 w-3/4 mb-4" />
          {/* Subtitle skeleton */}
          <Skeleton className="h-6 w-1/2" />
        </div>

        {/* Editor Content Skeleton */}
        <div className="px-8 pt-2 pb-8 md:px-12 md:pb-12">
          <div className="space-y-4">
            {/* Paragraph lines with varying lengths */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
            </div>

            {/* Another paragraph */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            {/* Heading-like skeleton */}
            <Skeleton className="h-6 w-1/3 mt-6" />

            {/* More content */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>

            {/* List-like content */}
            <div className="space-y-1 ml-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>

            {/* More paragraphs */}
            <div className="space-y-2 mt-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
