"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DayCloseButton({ alreadyClosed }: { alreadyClosed: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (alreadyClosed) {
    return <p className="text-sm text-emerald-600">Today is closed out — see you tomorrow! 🎯</p>;
  }

  async function handleClick() {
    setLoading(true);
    try {
      await fetch("/api/day-close", { method: "POST" });
      router.push("/recap");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
    >
      {loading ? "Closing out..." : "I'm done for today"}
    </button>
  );
}
