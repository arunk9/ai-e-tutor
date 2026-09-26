"use client";

import { useEffect, useState } from "react";
import { Markdown } from "@/components/Markdown";

export function RecapCard({
  initialRecapText,
  minutes,
  topicsDone,
}: {
  initialRecapText: string | null;
  minutes: number;
  topicsDone: number;
}) {
  const [recapText, setRecapText] = useState(initialRecapText);
  const [loading, setLoading] = useState(!initialRecapText);

  useEffect(() => {
    if (recapText) return;
    fetch("/api/recap", { method: "POST" })
      .then(async (res) => {
        const data = await res.json();
        setRecapText(data.recapText ?? data.error ?? "Couldn't generate a recap right now.");
      })
      .finally(() => setLoading(false));
  }, [recapText]);

  return (
    <div className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h1 className="text-lg font-semibold">Today&apos;s Recap</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {minutes} minutes &middot; {topicsDone} topic{topicsDone === 1 ? "" : "s"}
      </p>
      <div className="mt-4">
        {loading ? <p className="text-sm text-zinc-500">Writing your recap...</p> : <Markdown>{recapText ?? ""}</Markdown>}
      </div>
    </div>
  );
}
