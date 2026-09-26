import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getWeekInfo } from "@/lib/planner";
import { RecapCard } from "@/components/RecapCard";

export default async function RecapPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const week = getWeekInfo(user);
  const studyDay = await prisma.studyDay.findUnique({ where: { userId_date: { userId: user.id, date: week.dateStr } } });
  if (!studyDay || !studyDay.closed) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <RecapCard
        initialRecapText={studyDay.recapText}
        minutes={studyDay.minutesStudied}
        topicsDone={(studyDay.topicsTouched as unknown as string[]).length}
      />
    </div>
  );
}
