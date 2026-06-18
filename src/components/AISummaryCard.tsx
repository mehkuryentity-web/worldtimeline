import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { generateBriefing } from "@/lib/news.functions";
import { buildBriefing } from "@/lib/intelligence/briefing";
import { useAppState } from "@/hooks/use-app-state";

interface Props {
  headlines: string[];
}

export function AISummaryCard({ headlines }: Props) {
  const { state } = useAppState();

  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(300); // 5 min countdown
  const [manualRefresh, setManualRefresh] = useState(0);

  const userName = state?.user?.name ?? null;

  async function load() {
    setLoading(true);

    try {
      // metadata only (no narrative role anymore)
      buildBriefing({
        headlines,
        userName,
        country: "GLOBAL",
      });

      // REAL NARRATIVE COMES FROM GEMINI
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
  }, [headlines, manualRefresh]);

  // countdown timer (5 min)
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
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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
          Composing live briefing...
        </div>
      ) : (
        <div className="text-sm leading-relaxed text-foreground/90">
          <p>{summary}</p>
        </div>
      )}
    </div>
  );
}
