import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export default function AppsLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <CardGridSkeleton />
    </div>
  );
}
