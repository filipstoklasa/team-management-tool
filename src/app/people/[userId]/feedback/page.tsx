import { FeedbackPanel } from "@/components/people/feedback-panel";
import { PeopleRecordsUnavailable } from "@/components/people/people-records-unavailable";
import { getFeedback, peopleRecordsAvailable } from "@/data/people.ts";

export default async function FeedbackPage({
  params,
}: PageProps<"/people/[userId]/feedback">) {
  const { userId } = await params;
  const id = Number(userId);
  if (!peopleRecordsAvailable()) return <PeopleRecordsUnavailable />;
  return <FeedbackPanel userId={id} items={await getFeedback(id)} />;
}
