import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { buildBriefing } from "@/lib/intelligence/briefing";
import { useAppState } from "@/hooks/use-app-state";

interface Props {
  headlines: string[];
  country?: string;
}

export function AISummaryCard({ headlines, country }: Props) {
  const { state } = useAppState();

  const userName = state?.user?.name ?? null;

  const [briefing, setBriefing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 5-minute cycle controller
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [version, setVersion] = useState(0);

  /* -----------------------------
     BUILD BRIEFING
  ------------------------------*/
  const build = () => {
    setLoading(true);

    const result = buildBriefing({
      headlines,
      userName,
      country,
    });

    setBriefing(result);
    setLoading(false);
  };

  /* -----------------------------
     REBUILD ON CHANGE
  ------------------------------*/
  useEffect(() => {
    build();
  }, [version, headlines, userName, country]);

  /* -----------------------------
     5-MINUTE COUNTDOWN + AUTO REFRESH
  ------------------------------*/
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setVersion((v) => v + 1); // auto refresh
          return 300;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const manualRefresh = () => {
    setVersion((v) => v + 1);
    setSecondsLeft(300);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          AI Briefing · {mm}:{ss}
        </div>

        <button
          onClick={manualRefresh}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* BODY */}
      {loading || !briefing ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Composing briefing...
        </div>
      ) : (
        <div className="space-y-3 text-sm leading-relaxed text-foreground/90">

          {/* OPENING */}
          <p className="font-medium">{briefing.opening}</p>

          {/* SINGLE NEWSROOM PARAGRAPH (NO MAP ANYMORE) */}
          <p>
            {briefing.newsroomParagraph}
          </p>

          {/* CONCLUSION */}
          <p className="font-semibold border-t border-border pt-2">
            {briefing.conclusion}
          </p>

        </div>
      )}
    </div>
  );
}
