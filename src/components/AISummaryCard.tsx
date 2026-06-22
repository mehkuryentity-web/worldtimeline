import { useEffect, useState } from "react";

const CACHE_KEY = "wt:ai-briefing:v1";

/* -----------------------------
   CACHE LAYER (FAST PATH)
------------------------------*/
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

/* -----------------------------
   TIME-BASED GREETING
------------------------------*/
function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/* -----------------------------
   FETCH BRIEFING (FALLBACK ONLY)
------------------------------*/
async function fetchBriefing(headlines: string[]) {
  try {
    const res = await fetch(
      "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/generate-briefing",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ headlines }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    return data?.summary || null;
  } catch {
    return null;
  }
}

/* -----------------------------
   MAIN COMPONENT
------------------------------*/
export function AISummaryCard({ headlines }: { headlines: string[] }) {
  const [text, setText] = useState<string>(() => {
    const cached = getCache();
    if (cached) return cached;

    // IMPORTANT: no fake loading UI
    return "";
  });

  useEffect(() => {
    let alive = true;

    async function run() {
      // STEP 1: ALWAYS TRUST CACHE FIRST
      const cached = getCache();
      if (cached) {
        if (alive) setText(cached);
        return;
      }

      // STEP 2: FETCH ONLY IF NO CACHE
      const briefing = await fetchBriefing(headlines);

      if (!alive || !briefing) return;

      const final =
        `${getGreeting()}, ` +
        `${briefing}`;

      setCache(final);
      setText(final);
    }

    run();

    return () => {
      alive = false;
    };
  }, [headlines]);

  /* -----------------------------
     RENDER (NO LOADING STATE EVER)
  ------------------------------*/
  return (
    <div className="rounded-xl border border-border bg-black/60 p-4 text-white">
      <div className="text-[10px] uppercase tracking-wider text-white/60 flex items-center gap-2">
        ✦ AI Briefing
      </div>

      <p className="mt-2 text-sm leading-relaxed text-white/90">
        {text}
      </p>

      {/* optional subtle footer indicator */}
      <div className="mt-3 text-[10px] text-white/40 text-right">
        live intelligence feed
      </div>
    </div>
  );
}
