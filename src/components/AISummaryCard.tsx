import { useEffect, useState } from "react";

const CACHE_KEY = "wt:ai-briefing:v1";

/* -------------------------
   CACHE
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
   FETCH SUPABASE
--------------------------*/
async function fetchBriefing(): Promise<string | null> {
  try {
    const res = await fetch(
      "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/generate-briefing",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    const data = await res.json();

    return data?.summary ?? null;
  } catch {
    return null;
  }
}

/* -------------------------
   COMPONENT
--------------------------*/
export function AISummaryCard() {
  const [text, setText] = useState<string>(() => {
    const cached = getCache();
    return cached ? cached : `${getGreeting()} 👋 Loading briefing...`;
  });

  useEffect(() => {
    let alive = true;

    async function run() {
      const cached = getCache();

      // If cache exists → still fetch in background (NO WAIT UX BLOCK)
      const summary = await fetchBriefing();

      if (!alive || !summary) return;

      setCache(summary);
      setText(summary);
    }

    run();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-black/60 p-4 text-white">
      <div className="text-[10px] uppercase tracking-widest opacity-60">
        AI Briefing
      </div>

      <p className="mt-2 text-sm leading-relaxed">
        {text}
      </p>
    </div>
  );
}
