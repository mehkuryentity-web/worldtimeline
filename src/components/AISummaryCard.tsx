import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { generateBriefing } from "@/lib/news.functions";
import { useAppState } from "@/hooks/use-app-state";
import { supabase } from "@/lib/supabaseClient";

function hashHeadlines(headlines: string[]) {
  return headlines.slice(0, 5).join("|");
}

export function AISummaryCard() {
  const { state } = useAppState();

  const [summary, setSummary] = useState<string>("");

  const userName = state?.user?.name ?? null;

  async function load() {
    try {
      const res = await fetch("/api/news?category=Top&country=GLOBAL");
      const data = await res.json();

      const headlines: string[] =
        (data?.items ?? []).slice(0, 6).map((i: any) => i.title) || [];

      if (!headlines.length) {
        setSummary("Waiting for live newsroom signals...");
        return;
      }

      const hash = hashHeadlines(headlines);

      // 1. CHECK CACHE FIRST
      const cached = await supabase
        .from("ai_briefings")
        .select("summary")
        .eq("headlines_hash", hash)
        .maybeSingle();

      if (cached?.data?.summary) {
        setSummary(cached.data.summary);

        // background refresh (silent)
        generateIfNeeded(headlines, hash);
        return;
      }

      // 2. FIRST USER ONLY: GENERATE + SHOW IMMEDIATELY
      const result = await generateBriefing({ headlines, userName });

      setSummary(result.summary);

      await supabase.from("ai_briefings").insert({
        summary: result.summary,
        headlines_hash: hash,
        country: "GLOBAL",
      });
    } catch (e) {
      setSummary("Live briefing temporarily unavailable.");
    }
  }

  async function generateIfNeeded(headlines: string[], hash: string) {
    const exists = await supabase
      .from("ai_briefings")
      .select("id")
      .eq("headlines_hash", hash)
      .maybeSingle();

    if (exists.data) return;

    const result = await generateBriefing({ headlines, userName });

    setSummary(result.summary);

    await supabase.from("ai_briefings").insert({
      summary: result.summary,
      headlines_hash: hash,
      country: "GLOBAL",
    });
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

      {/* NO LOADING STATE ANYMORE */}
      <div className="text-sm leading-relaxed">
        {summary || "Loading briefing..."}
      </div>
    </div>
  );
}
