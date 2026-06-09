import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { getInitialSummary, MOCK_NEWS } from "@/lib/mock-news";
import { useAppState } from "@/hooks/use-app-state";

const REFRESH_MS = 5 * 60 * 1000;

function makeSummary() {
  // Lightweight rotating summary stitched from the freshest mock items.
  // When Cloud + AI Gateway are enabled, this will be replaced with a server fn.
  const sorted = [...MOCK_NEWS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  const top = sorted.slice(0, 4);
  const lines = top.map((n) => {
    const verb = n.breaking ? "Breaking:" : "Update:";
    return `${verb} ${n.title}.`;
  });
  return lines.join(" ");
}

export function AISummaryCard() {
  const [summary, setSummary] = useState(() => getInitialSummary());
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  const [tick, setTick] = useState(0);
  const { award } = useAppState();
  const awarded = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setSummary(makeSummary());
      setRefreshedAt(new Date());
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

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
    setSummary(makeSummary());
    setRefreshedAt(new Date());
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
          className="flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition hover:text-primary"
        >
          <RefreshCw className="h-3 w-3" />
          {nextIn}
        </button>
      </div>
      <div className="px-4 py-4">
        <p className="text-[15px] leading-relaxed text-foreground/90">{summary}</p>
        <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>auto-refresh · 5 min</span>
          <span>
            sources: <span className="text-foreground/80">42 wires</span>
          </span>
        </div>
      </div>
    </section>
  );
}
