import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { generateBriefing } from "@/lib/news.functions";

export function AISummaryCard({ headlines = [] }: { headlines: string[] }) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      if (!headlines.length) {
        setSummary("Waiting for live newsroom signals...");
        return;
      }

      setLoading(true);

      const result = await generateBriefing({ headlines });

      setSummary(result.summary);
    } catch (e) {
      console.error("AISummaryCard error:", e);
      setSummary("Briefing temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  if (!headlines || headlines.length < 3) return;
  load();
}, [headlines]);

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase text-muted-foreground">
          AI Briefing
        </div>

        <button
          onClick={load}
          className="text-xs flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <div className="text-sm leading-relaxed">
        {loading ? "Composing briefing..." : summary || "Loading..."}
      </div>
    </div>
  );
}
