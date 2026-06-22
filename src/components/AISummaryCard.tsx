import { useEffect, useState } from "react";

const CACHE_KEY = "wt:ai-briefing:v1";

/**
 * Instant cache read (no network)
 */
function getCachedBriefing(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist briefing for instant reuse
 */
function setCachedBriefing(text: string) {
  try {
    localStorage.setItem(CACHE_KEY, text);
  } catch {}
}

/**
 * Fetch AI briefing from Supabase function
 */
async function fetchBriefing(headlines: string[]): Promise<string> {
  try {
    const res = await fetch(
      "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/generate-briefing",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ headlines }),
      }
    );

    if (!res.ok) return "";

    const data = await res.json();
    return data?.summary || "";
  } catch {
    return "";
  }
}

interface Props {
  headlines: string[];
}

export function AISummaryCard({ headlines }: Props) {
  const cached = getCachedBriefing();

  const [text, setText] = useState<string>(() => {
    /**
     * FIRST PAINT RULE:
     * - If cache exists → show it instantly
     * - If not → show neutral placeholder (NOT "AI CARD LOADED")
     */
    return cached || "…";
  });

  useEffect(() => {
    let alive = true;

    async function run() {
      // If cache exists → NEVER fetch on first render
      if (cached) return;

      const briefing = await fetchBriefing(headlines);

      if (!alive) return;

      if (briefing) {
        setText(briefing);
        setCachedBriefing(briefing);
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
