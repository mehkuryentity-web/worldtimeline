import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const CACHE_KEY = "wt:ai_briefing";

function getCache() {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

function setCache(value: string) {
  try {
    localStorage.setItem(CACHE_KEY, value);
  } catch {}
}

export function AISummaryCard() {
  const [text, setText] = useState<string>(() => getCache() || "");

  useEffect(() => {
    let alive = true;

    async function load() {
      // 1. show cached instantly if it exists
      const cached = getCache();
      if (cached) {
        setText(cached);
      }

      // 2. fetch latest briefing from Supabase
      const { data, error } = await supabase
        .from("ai_briefings")
        .select("summary")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!alive) return;

      if (error) {
        console.error("AI briefing error:", error);
        if (!cached) setText("Newsroom is warming up...");
        return;
      }

      const summary = data?.summary;

      if (summary) {
        setCache(summary);
        setText(summary);
      } else if (!cached) {
        setText("Newsroom is warming up...");
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  if (!text) {
    return (
      <div className="rounded-xl border p-3 text-sm text-muted-foreground">
        Loading briefing...
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-3 text-sm leading-relaxed">
      {text}
    </div>
  );
}
