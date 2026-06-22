import { useEffect, useState } from "react";
import { generateBriefing } from "@/lib/news.functions";

const CACHE_KEY = "wt:ai-briefing:v1";

/* -------------------------
   CACHE HELPERS
--------------------------*/
function getCache(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

function setCache(value: string) {
  try {
    localStorage.setItem(CACHE_KEY, value);
  } catch {}
}

/* -------------------------
   TIME GREETING
--------------------------*/
function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/* -------------------------
   COMPONENT
--------------------------*/
export function AISummaryCard() {
  const [text, setText] = useState<string>(() => {
    const cached = getCache();
    return cached || `${getGreeting()} 👋 Preparing your briefing...`;
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      // STEP 1: instant cache render (no fetch delay)
      const cached = getCache();
      if (cached) {
        setText(cached);
        return;
      }

      // STEP 2: fetch Supabase briefing
      const res = await generateBriefing();

      if (!alive) return;

      console.log("RAW_BRIEFING_RESULT:", res);

      // STEP 3: strict validation (prevents fallback loops)
      const summary = res?.summary;

      if (typeof summary === "string" && summary.trim().length > 0) {
        setCache(summary);
        setText(summary);
        return;
      }

      // STEP 4: ONLY fallback (never "waiting for signals")
      const fallback = `${getGreeting()} 👋 Global newsroom is active. Stories are developing across markets, politics, technology, and culture in real time.`;

      setText(fallback);
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-black/60 p-4 text-white">
      <div className="text-[10px] uppercase tracking-widest opacity-60">
        AI Briefing
      </div>

      <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}
