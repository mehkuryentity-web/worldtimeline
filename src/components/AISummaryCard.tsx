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
interface Props {
  headlines: string[];
}

export function AISummaryCard({ headlines }: Props) {
  const [text, setText] = useState<string>(() => {
    const cached = getCache();
    return cached || `${getGreeting()} 👋 Preparing your briefing...`;
  });

  useEffect(() => {
    let alive = true;

    async function run() {
      // STEP 1: ALWAYS show cache instantly (never block UI)
      const cached = getCache();
      if (cached) {
        setText(cached);
        return;
      }

      // STEP 2: fetch briefing from Supabase edge function
      const res = await generateBriefing();

      if (!alive) return;

      // STEP 3: only accept valid summary
      if (res?.summary && res.summary.length > 10) {
        setCache(res.summary);
        setText(res.summary);
        return;
      }

      // STEP 4: HARD fallback (never show "waiting for signals")
      setText(
        `${getGreeting()} 👋 Live newsroom is syncing across global feeds. Stories are forming across markets, politics, and tech. Stay tuned.`
      );
    }

    run();

    return () => {
      alive = false;
    };
  }, [headlines]);

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
