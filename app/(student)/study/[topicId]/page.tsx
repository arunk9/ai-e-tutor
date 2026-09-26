import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getTopic } from "@/lib/content";
import { getThreadHistory } from "@/lib/tutor";
import { LessonCard } from "@/components/LessonCard";
import { ChatPanel } from "@/components/ChatPanel";
import { PracticePanel } from "@/components/PracticePanel";

export default async function StudyPage({ params }: { params: Promise<{ topicId: string }> }) {
  const { topicId } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const found = getTopic(topicId);
  if (!found) notFound();

  const history = await getThreadHistory(user.id, topicId);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="text-xs text-zinc-500">
        {found.subject} &rsaquo; {found.topic.title}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <LessonCard topic={found.topic} />
          <PracticePanel topicId={topicId} />
        </div>
        <ChatPanel topicId={topicId} initialMessages={history.map(({ role, content }) => ({ role, content }))} />
      </div>
    </div>
  );
}
