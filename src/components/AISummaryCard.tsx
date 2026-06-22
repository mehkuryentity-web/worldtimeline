import { useEffect, useState } from "react";
import { generateBriefing } from "@/lib/news.functions";

const CACHE_KEY = "wt:ai-briefing:v1";

/**
 * Instant read (NO loading state dependency)
 */
function getCache(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist briefing for instant next paint
 */
function setCache(value: string) {
  try {
    localStorage.setItem(CACHE_KEY, value);
  } catch {}
}

interface Props {
  headlines: string[];
}

export function AISummaryCard({ headlines }: Props) {
  // CRITICAL: never show fake placeholder as final UI state
  const [text, setText] = useState<string>(() => {
    const cached = getCache();
    return cached ?? "Generating briefing...";
  });

  useEffect(() => {
    let alive = true;

    async function run() {
      // If cache exists → NEVER fetch
      const cached = getCache();
      if (cached) {
        setText(cached);
        return;
      }

      // No cache → generate once
      const result = await generateBriefing({
        headlines: headlines.slice(0, 5),
      });

      if (!alive) return;

      const summary = result?.summary?.trim();

      if (summary) {
        setCache(summary);
        setText(summary);
      } else {
        setText("Live briefing unavailable. Feed is still updating.");
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [headlines]);

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        AI Briefing
      </div>

      <p className="mt-2 text-sm leading-relaxed text-foreground">
        {text}
      </p>
    </div>
  );
}
