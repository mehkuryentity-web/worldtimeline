import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import { supabase } from "../lib/supabaseClient";

function hashHeadlines(headlines: string[]) {
  return headlines.slice(0, 5).join("|");
}

export function AISummaryCard() {
  const { state } = useAppState();

  const [summary, setSummary] = useState<string>("");

  const userName = state?.user?.name ?? null;

  async function load() { 
    console.log("AISummaryCard loaded");
    try {
      const res = await fetch("/api/news?category=Top&country=GLOBAL");
      const data = await res.json();

      const headlines: string[] =
        (data?.items ?? [])
          .slice(0, 6)
          .map((i: any) => i.title)
          .filter(Boolean);

      if (!headlines.length) {
        setSummary("Waiting for live newsroom signals...");
        return;
      }

      const hash = hashHeadlines(headlines);

      // 1. CHECK CACHE FIRST
      const { data: cached } = await supabase
        .from("ai_briefings")
        .select("summary")
        .eq("headlines_hash", hash)
        .maybeSingle();

      if (cached?.summary) {
        setSummary(cached.summary);
        return;
      }

      // 2. FALLBACK: FETCH PREGENERATED / BACKEND HANDLED BRIEFING
      const fallback = await supabase
        .from("ai_briefings")
        .select("summary")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallback?.data?.summary) {
        setSummary(fallback.data.summary);
        return;
      }

      setSummary("Briefing is being prepared...");
    } catch (e) {
      setSummary("Live briefing temporarily unavailable.");
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

        <button
          onClick={load}
          className="text-xs flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <div className="text-sm leading-relaxed">
        {summary || "Loading briefing..."}
      </div>
    </div>
  );
}
