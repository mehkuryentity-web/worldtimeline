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
    // 🔥 INSTANT FIRST PAINT (NO NETWORK)
    const cached = getCache();
    return cached || `${getGreeting()} 👋 Preparing your briefing...`;
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      // STEP 1: if cache exists, STOP. no fetch. no flicker.
      const cached = getCache();
      if (cached) {
        setText(cached);
        return;
      }

      // STEP 2: fetch briefing from Supabase Edge Function
      const res = await generateBriefing();

      if (!alive) return;

      // STEP 3: only accept valid response
      if (res?.summary && res.summary.trim().length > 10) {
        setCache(res.summary);
        setText(res.summary);
        return;
      }

      // STEP 4: HARD fallback (NEVER show "waiting for signals")
      const fallback = `${getGreeting()} 👋 Live newsroom is syncing global updates across markets, politics, tech, and science. Stories are forming in real time.`;

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
