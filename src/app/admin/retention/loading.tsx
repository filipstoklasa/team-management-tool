import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, RowsSkeleton } from "@/components/skeletons";

export default function RetentionLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton wide />
      <Skeleton className="h-24 w-full rounded-lg" />
      <RowsSkeleton rows={3} />
    </div>
  );
}
