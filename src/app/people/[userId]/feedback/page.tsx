import { FeedbackPanel } from "@/components/people/feedback-panel";
import { ModuleBUnavailable } from "@/components/people/module-b-unavailable";
import { getFeedback, moduleBAvailable } from "@/data/people.ts";

export default async function FeedbackPage({
  params,
}: PageProps<"/people/[userId]/feedback">) {
  const { userId } = await params;
  const id = Number(userId);
  if (!moduleBAvailable()) return <ModuleBUnavailable />;
  return <FeedbackPanel userId={id} items={await getFeedback(id)} />;
}
