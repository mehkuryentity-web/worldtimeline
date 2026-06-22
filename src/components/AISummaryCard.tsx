import { useEffect, useState } from "react";

const CACHE_KEY = "wt:ai-briefing:v1";

/**
 * Read cache instantly (no network)
 */
function getCache(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

/**
 * Save cache for instant next load
 */
function setCache(value: string) {
  try {
    localStorage.setItem(CACHE_KEY, value);
  } catch {}
}

/**
 * Normalize ANY backend response shape
 */
function extractBriefing(data: any): string {
  return (
    data?.summary ||
    data?.data?.summary ||
    data?.message ||
    data?.text ||
    ""
  );
}

/**
 * Time-based greeting
 */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

interface Props {
  headlines: string[];
}

export function AISummaryCard({ headlines }: Props) {
  const cached = getCache();

  const [text, setText] = useState<string>(() => {
    // ⚡ instant paint rule
    return cached || "";
  });

  useEffect(() => {
    let alive = true;

    async function run() {
      // 1. CACHE FIRST (NO FETCH)
      const cachedNow = getCache();
      if (cachedNow) {
        setText(cachedNow);
        return;
      }

      // 2. FETCH ONLY IF NO CACHE
      try {
        const res = await fetch(
          "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/generate-briefing",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              headlines: headlines.slice(0, 5),
            }),
          }
        );

        const data = await res.json();

        if (!alive) return;

        const summary = extractBriefing(data);

        if (summary && summary.trim().length > 0) {
          const finalText =
            `${greeting()}, ${summary.trim()} ` +
            `That’s the pulse for now — fast, messy, and still unfolding.`;

          setCache(finalText);
          setText(finalText);
        } else {
          setText(
            `${greeting()}, the newsroom is quiet for a moment — updates are still forming.`
          );
        }
      } catch {
        if (!alive) return;

        setText(
          `${greeting()}, live briefing is temporarily unavailable — but the feed continues to move.`
        );
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
