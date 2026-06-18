import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { buildBriefing } from "@/lib/intelligence/briefing";
import { useAppState } from "@/hooks/use-app-state";

interface Props {
  headlines: string[];
}

const REFRESH_INTERVAL = 5 * 60;

export function AISummaryCard({ headlines }: Props) {
  const { state } = useAppState();

  const [opening, setOpening] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [countryContext, setCountryContext] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_INTERVAL);

  const refreshBriefing = useCallback(() => {
    setLoading(true);

    try {
      const result = buildBriefing({
        headlines,
        userName: state?.user?.name ?? null,
        country: state?.country ?? "GLOBAL",
      });

      setOpening(result.opening);
      setLines(result.lines);
      setCountryContext(result.countryContext);
      setConclusion(result.conclusion);
    } catch (err) {
      console.error("Briefing build failed:", err);

      setOpening("Today's news is unfolding across multiple fronts.");
      setLines(headlines.slice(0, 5));
      setCountryContext("");
      setConclusion("");
    } finally {
      setLoading(false);
      setSecondsLeft(REFRESH_INTERVAL);
    }
  }, [headlines, state?.user?.name, state?.country]);

  useEffect(() => {
    refreshBriefing();
  }, [refreshBriefing]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          refreshBriefing();
          return REFRESH_INTERVAL;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [refreshBriefing]);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          AI Briefing · {minutes}:{seconds}
        </div>

        <button
          onClick={refreshBriefing}
          className="text-muted-foreground hover:text-foreground transition"
          aria-label="Refresh briefing"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Composing briefing...
        </div>
      ) : (
        <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
          <p className="font-medium">{opening}</p>

          {countryContext && (
            <p className="text-muted-foreground">
              {countryContext}
            </p>
          )}

          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}

          {conclusion && (
            <p className="border-t border-border pt-3 font-medium">
              {conclusion}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
