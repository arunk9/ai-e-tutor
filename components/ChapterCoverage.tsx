import Link from "next/link";
import { MasteryBar } from "@/components/MasteryBar";
import type { Subject } from "@/lib/content";

export interface CoverageTopic {
  topicId: string;
  title: string;
  order: number;
  mastery: number;
  attemptsCount: number;
}

export interface CoverageChapter {
  subject: Subject;
  title: string;
  topics: CoverageTopic[];
}

const SUBJECT_LABEL: Record<Subject, string> = { maths: "Maths", physics: "Physics", chemistry: "Chemistry" };

export function ChapterCoverage({ chapters }: { chapters: CoverageChapter[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {chapters.map((chapter) => {
        const touched = chapter.topics.filter((t) => t.attemptsCount > 0).length;
        const avgMastery = chapter.topics.reduce((s, t) => s + t.mastery, 0) / chapter.topics.length;

        return (
          <div key={chapter.subject} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">{SUBJECT_LABEL[chapter.subject]}</h3>
              <span className="text-xs text-zinc-500">
                {touched}/{chapter.topics.length} topics started
              </span>
            </div>
            <p className="mb-3 text-xs text-zinc-500">{chapter.title}</p>
            <MasteryBar mastery={avgMastery} />

            <ul className="mt-3 space-y-2">
              {chapter.topics
                .sort((a, b) => a.order - b.order)
                .map((topic) => (
                  <li key={topic.topicId}>
                    <Link href={`/study/${topic.topicId}`} className="block hover:opacity-80">
                      <div className="mb-0.5 flex items-center justify-between text-xs">
                        <span className="truncate">{topic.title}</span>
                      </div>
                      <MasteryBar mastery={topic.mastery} />
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
