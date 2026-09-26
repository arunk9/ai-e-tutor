import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getPaperTemplates } from "@/lib/content";
import { getWeekInfo } from "@/lib/planner";
import { getOrCreatePaper, buildClientItemsForPaper, getPaperResults, type PaperItem } from "@/lib/assessment";
import { TestRunner } from "@/components/TestRunner";
import { ResultsView } from "@/components/ResultsView";

export default async function TestPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const week = getWeekInfo(user);
  const paper = await getOrCreatePaper(user.id, week.weekNumber, week.pattern);

  if (paper.status === "submitted") {
    const results = await getPaperResults(paper.id);
    if (results) return <ResultsView results={results} />;
  }

  const items = buildClientItemsForPaper(paper.items as unknown as PaperItem[]);
  const template = getPaperTemplates()[week.pattern];
  const totalSeconds = template.durationMinutesPerSubject * 60 * 3;

  return <TestRunner paperId={paper.id} items={items} totalSeconds={totalSeconds} />;
}
