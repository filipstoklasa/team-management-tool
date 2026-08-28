import { PageHeaderSkeleton, RowsSkeleton } from "@/components/skeletons";

export default function PeopleLoading() {
  return (
    <div className="space-y-5">
      <PageHeaderSkeleton />
      <RowsSkeleton rows={8} />
    </div>
  );
}
