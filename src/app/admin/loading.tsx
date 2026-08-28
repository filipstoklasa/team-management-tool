import { PageHeaderSkeleton, RowsSkeleton } from "@/components/skeletons";

export default function AdminLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <RowsSkeleton rows={8} />
      <RowsSkeleton rows={5} />
      <RowsSkeleton rows={3} />
    </div>
  );
}
