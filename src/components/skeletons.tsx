import { Skeleton } from "@/components/ui/skeleton";

/**
 * §10.5 — every route segment has a `loading.tsx`. `<Link>` prefetches a dynamic
 * route down to the nearest loading boundary, so in a production build the
 * skeleton is already in the client before the click lands.
 *
 * These shapes deliberately match the real layout's proportions. A skeleton
 * that is the wrong size is worse than none: the page visibly jumps when the
 * data arrives.
 */

export function PageHeaderSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className={wide ? "h-8 w-64" : "h-8 w-40"} />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y overflow-hidden rounded-lg border">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-4">
            <div className="w-40 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-3.5 flex-1 rounded-full" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ cards = 5 }: { cards?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl border p-5">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3.5 w-full rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
