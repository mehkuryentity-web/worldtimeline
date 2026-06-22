import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "wt:ai-briefing:v1";

/**
 * Read cached briefing instantly (no network)
 */
function getCachedBriefing(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

/**
 * Save briefing for instant next load
 */
function setCachedBriefing(text: string) {
  try {
    localStorage.setItem(CACHE_KEY, text);
  } catch {}
}

/**
 * Fetch latest AI briefing from Supabase function
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

    if (!res.ok) throw new Error("Briefing fetch failed");

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
  const [text, setText] = useState<string>(() => {
    // 🔥 INSTANT FIRST PAINT
    return getCachedBriefing() || "AI CARD LOADED";
  });

  useEffect(() => {
    let mounted = true;

    async function run() {
      // 1. If cache exists, DO NOTHING (instant UX rule)
      const cached = getCachedBriefing();
      if (cached) return;

      // 2. Otherwise fetch once
      const briefing = await fetchBriefing(headlines);

      if (!mounted) return;

      if (briefing) {
        setText(briefing);
        setCachedBriefing(briefing);
      }
    }

    run();

    return () => {
      mounted = false;
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
