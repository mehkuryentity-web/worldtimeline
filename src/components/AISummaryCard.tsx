import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import { supabase } from "../lib/supabaseClient";

function hashHeadlines(headlines: string[]) {
  return headlines.slice(0, 5).join("|");
}

export function AISummaryCard() {
  const { state } = useAppState();

  const [summary, setSummary] = useState<string>("Loading briefing...");
  const [loading, setLoading] = useState(false);

  const userName = state?.user?.name ?? null;

  async function load() {
    console.log("STEP 1: load started");

    setLoading(true);

    try {
      const res = await fetch("/api/news?category=Top&country=GLOBAL");

      console.log("STEP 2: fetch status", res.status);

      const data = await res.json();

      console.log("STEP 3: data received", data);

      const headlines: string[] =
        (data?.items ?? [])
          .slice(0, 6)
          .map((i: any) => i.title)
          .filter(Boolean);

      console.log("STEP 4: headlines", headlines);

      if (!headlines.length) {
        setSummary("Waiting for newsroom signals...");
        return;
      }

      const hash = hashHeadlines(headlines);

      // SAFE SUPABASE CHECK (wrapped so it cannot crash UI)
      let cachedSummary = null;

      try {
        const { data: cached } = await supabase
          .from("ai_briefings")
          .select("summary")
          .eq("headlines_hash", hash)
          .maybeSingle();

        cachedSummary = cached?.summary ?? null;
      } catch (e) {
        console.log("Supabase cache check failed:", e);
      }

      if (cachedSummary) {
        setSummary(cachedSummary);
        return;
      }

      // fallback display (no AI calls here anymore)
      setSummary(headlines.join(" • "));
    } catch (e) {
      console.log("ERROR CAUGHT IN LOAD:", e);
      setSummary("Failed to load briefing data");
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

        <button
          onClick={load}
          className="text-xs flex items-center gap-1"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      <div className="text-sm leading-relaxed">
        {loading ? "Loading..." : summary}
      </div>
    </div>
  );
}
