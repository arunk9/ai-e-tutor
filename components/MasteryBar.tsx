function colorFor(mastery: number): string {
  if (mastery >= 0.85) return "bg-emerald-500";
  if (mastery >= 0.6) return "bg-amber-500";
  if (mastery > 0) return "bg-red-500";
  return "bg-zinc-300 dark:bg-zinc-700";
}

export function MasteryBar({ mastery }: { mastery: number }) {
  const pct = Math.round(mastery * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className={`h-full rounded-full ${colorFor(mastery)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-xs text-zinc-500">{pct}%</span>
    </div>
  );
}
