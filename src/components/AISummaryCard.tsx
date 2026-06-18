import { useEffect, useMemo, useState } from "react";
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
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const userName = state?.user?.name ?? null;

  const briefing = useMemo(() => {
    return buildBriefing({
      headlines,
      userName,
      country,
      refreshKey,
    });
  }, [headlines, userName, country, refreshKey]);

  useEffect(() => {
    setLoading(true);

    const t = setTimeout(() => {
      setData(briefing);
      setLoading(false);
    }, 200);

    return () => clearTimeout(t);
  }, [briefing]);

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-3">
      {/* HEADER + REFRESH */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          AI Briefing · {new Date().toLocaleTimeString().slice(0, 5)}
        </div>

        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {loading || !data ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Composing briefing...
        </div>
      ) : (
        <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
          <p className="font-medium">{data.opening}</p>

          {data.stories.map((s: string, i: number) => (
            <p key={i}>{s}</p>
          ))}

          <p className="font-medium pt-2 border-t border-border">
            {data.conclusion}
          </p>
        </div>
      )}
    </div>
  );
}
