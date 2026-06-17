import { useState, useEffect } from "react";
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
  const [text] = useState<string | null>(() => loadCache());
  const identity = getAIIdentity();

  useEffect(() => {
    // background engine handles generation
  }, [headlines]);

  const display =
    text ||
    `Hi ${identity}. Your personalized briefing is preparing in the background.`;

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        AI Briefing
      </div>

      <p className="text-sm leading-relaxed text-foreground/90">
        {display}
      </p>
    </div>
  );
}
