import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAppState } from "@/hooks/use-app-state";
import { generateBriefing } from "@/lib/news.functions";

const REFRESH_MS = 5 * 60 * 1000;

interface Props {
  headlines: string[];
}

export function AISummaryCard({ headlines }: Props) {
  const [summary, setSummary] = useState<string>("");
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const { award } = useAppState();
  const awarded = useRef(false);
  const briefing = useServerFn(generateBriefing);
  const lastKey = useRef<string>("");

  const generate = async (hl: string[]) => {
    if (hl.length === 0) return;
    setLoading(true);
    try {
      const res = await briefing({ data: { headlines: hl } });
      setSummary(res.summary);
      setRefreshedAt(new Date());
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate when headlines first arrive or change materially
  useEffect(() => {
    const key = headlines.slice(0, 4).join("|");
    if (!key || key === lastKey.current) return;
    lastKey.current = key;
    generate(headlines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headlines.join("|")]);

  // 5-minute auto refresh
  useEffect(() => {
    const id = setInterval(() => generate(headlines), REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headlines.join("|")]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const nextIn = useMemo(() => {
    const elapsed = (Date.now() - refreshedAt.getTime()) % REFRESH_MS;
    const left = Math.max(0, REFRESH_MS - elapsed);
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [refreshedAt, tick]);

  const handleRefresh = () => {
    generate(headlines);
    if (!awarded.current) {
      award("read_summary");
      awarded.current = true;
    }
  };

  return (
    <section className="relative overflow-hidden rounded-xl border border-border bg-surface-1 scanline-bg">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            Briefing · AI
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition hover:text-primary disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {nextIn}
        </button>
      </div>
      <div className="px-4 py-4">
        {summary ? (
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground/90">{summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {loading ? "Composing global briefing…" : "Awaiting headlines…"}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>auto-refresh · 5 min</span>
          <span>
            sources: <span className="text-foreground/80">CurrentsAPI · live</span>
          </span>
        </div>
      </div>
    </section>
  );
}
