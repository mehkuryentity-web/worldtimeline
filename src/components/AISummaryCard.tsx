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

  const [refreshKey, setRefreshKey] = useState(0);
  const [briefing, setBriefing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(Date.now());

  const userName = state?.user?.name ?? null;

  useEffect(() => {
    setLoading(true);

    const result = buildBriefing({
      headlines,
      userName,
      country,
      refreshKey,
    });

    setBriefing(result);
    setLoading(false);
    setTime(Date.now());
  }, [headlines, userName, country, refreshKey]);

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          AI Briefing · {new Date(time).toLocaleTimeString().slice(0, 5)}
        </div>

        <button
          onClick={() => setRefreshKey((k) => k + 1)}
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
          <p className="font-medium">{briefing.opening}</p>

          {briefing.stories.map((s: string, i: number) => (
            <p key={i}>{s}</p>
          ))}

          <p className="font-semibold pt-2 border-t border-border">
            {briefing.conclusion}
          </p>
        </div>
      )}
    </div>
  );
}
