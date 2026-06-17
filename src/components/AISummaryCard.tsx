import { useState } from "react";
import { getAIIdentity } from "@/lib/aiIdentity";

const CACHE_KEY = "wt:ai-home-briefing:v1";

function loadCache(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

export function AISummaryCard({ headlines }: { headlines: string[] }) {
  const [cached] = useState<string | null>(() => loadCache());
  const identity = getAIIdentity();

  const text =
    cached ||
    `Hi ${identity}. Your newsroom is syncing global updates across markets, governance, and technology.`;

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4">
      <div className="text-[10px] uppercase text-muted-foreground">
        AI Briefing
      </div>

      <p className="text-sm leading-relaxed text-foreground/90 mt-2">
        {text}
      </p>
    </div>
  );
}
