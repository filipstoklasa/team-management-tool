import { Skeleton } from "@/components/ui/skeleton";

/**
 * This sits inside the person layout, so the name, tab bar and back link stay
 * on screen — only the tab body is replaced. That makes tab switching feel like
 * a panel refresh rather than a page load.
 */
export default function PersonTabLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-2/3 rounded-lg" />
    </div>
  );
}
