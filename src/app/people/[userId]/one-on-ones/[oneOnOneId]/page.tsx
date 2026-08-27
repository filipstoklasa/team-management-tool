import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GuidancePanel } from "@/components/people/guidance-panel";
import { ModuleBUnavailable } from "@/components/people/module-b-unavailable";
import { OneOnOneEditor } from "@/components/people/one-on-one-editor";
import { ActionItemList } from "@/components/people/action-item-list";
import { getActionItems, getOneOnOne, moduleBAvailable } from "@/data/people.ts";

export default async function EditOneOnOnePage({
  params,
}: PageProps<"/people/[userId]/one-on-ones/[oneOnOneId]">) {
  const { userId, oneOnOneId } = await params;
  const id = Number(userId);
  if (!moduleBAvailable()) return <ModuleBUnavailable />;

  const session = await getOneOnOne(Number(oneOnOneId));
  if (!session || session.userId !== id) notFound();

  const items = (await getActionItems(id)).filter(
    (item) => item.oneOnOneId === session.id,
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-sm font-medium">1:1</CardTitle>
        </CardHeader>
        <CardContent>
          <OneOnOneEditor
            userId={id}
            existing={{
              id: session.id,
              date: session.date,
              managerNotes: session.managerNotes,
              theirTopics: session.theirTopics,
            }}
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Action items from this session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActionItemList items={items} userId={id} />
          </CardContent>
        </Card>
        <GuidancePanel />
      </div>
    </div>
  );
}
