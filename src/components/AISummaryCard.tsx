import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function AISummaryCard() {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

    try {
      // 1. READ FIRST (PRELOAD)
      const { data } = await supabase
        .from("ai_briefings")
        .select("summary")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data?.summary) {
        setSummary(data.summary);
        return;
      }

      // 2. fallback state only
      setSummary("No briefing available yet.");
    } catch (e) {
      console.error(e);
      setSummary("Briefing temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase text-muted-foreground">
          AI Briefing
        </div>

        <button onClick={load} className="text-xs flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <div className="text-sm leading-relaxed">
        {loading ? "Loading latest briefing..." : summary}
      </div>
    </div>
  );
}
