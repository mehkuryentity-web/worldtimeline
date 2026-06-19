import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { generateBriefing } from "@/lib/news.functions";
import { buildBriefing } from "@/lib/intelligence/briefing";
import { getHybridHeadlines } from "@/lib/intelligence/hybrid";
import { useAppState } from "@/hooks/use-app-state";

export function AISummaryCard() {
  const { state } = useAppState();

  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(300); // 5 min countdown
  const [manualRefresh, setManualRefresh] = useState(0);

  const userName = state?.user?.name ?? null;

  async function load() {
    setLoading(true);

    try {
      // 🔥 STEP 1: GET REAL INTELLIGENCE FEED (Supabase + Live + deduped)
      const headlines = await getHybridHeadlines("Top", "GLOBAL");

      // 🔥 STEP 2: metadata layer (no narration logic)
      buildBriefing({
        headlines,
        userName,
        country: "GLOBAL",
      });

      // 🔥 STEP 3: AI GENERATION (Gemini)
      const result = await generateBriefing({ headlines });

      setSummary(result.summary);
    } catch (e) {
      console.error("Briefing failed:", e);
      setSummary("Live briefing temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  // initial + refresh trigger
  useEffect(() => {
    load();
  }, [manualRefresh]);

  // countdown timer (5 min auto refresh)
  useEffect(() => {
    const interval = setInterval(() => {
      setTime((t) => {
        if (t <= 1) {
          load();
          return 300;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  function refreshNow() {
    setTime(300);
    setManualRefresh((v) => v + 1);
  }

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(
      s % 60
    ).padStart(2, "0")}`;

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          AI Briefing · {formatTime(time)}
        </div>

        <button
          onClick={refreshNow}
          className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {/* content */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Composing intelligence briefing...
        </div>
      ) : (
        <div className="text-sm leading-relaxed text-foreground/90">
          <p>{summary}</p>
        </div>
      )}
    </div>
  );
}
