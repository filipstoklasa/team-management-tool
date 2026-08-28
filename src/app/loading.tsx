import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, PanelSkeleton } from "@/components/skeletons";

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeaderSkeleton />
        <Skeleton className="h-9 w-96" />
      </div>
      <Skeleton className="h-[74px] w-full rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton rows={8} />
        <PanelSkeleton rows={5} />
      </div>
    </div>
  );
}
