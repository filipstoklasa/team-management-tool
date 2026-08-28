import { FeedbackPanel } from "@/components/people/feedback-panel";
import { getFeedback } from "@/data/people.ts";

export default async function FeedbackPage({
  params,
}: PageProps<"/people/[userId]/feedback">) {
  const { userId } = await params;
  const id = Number(userId);
  return <FeedbackPanel userId={id} items={await getFeedback(id)} />;
}
