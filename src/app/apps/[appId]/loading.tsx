import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, RowsSkeleton } from "@/components/skeletons";

export default function AppDetailLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton wide />
      <Skeleton className="h-64 w-full rounded-lg" />
      <RowsSkeleton rows={4} />
    </div>
  );
}
