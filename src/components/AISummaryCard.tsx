import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getAIIdentity } from "@/lib/aiIdentity";
import { fetchPreloadedSummaries } from "@/lib/news.functions";

const CACHE_KEY = "wt:ai-home-briefing:v1";

function loadCachedBriefing(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

function saveBriefing(text: string) {
  try {
    localStorage.setItem(CACHE_KEY, text);
  } catch {}
}

export function AISummaryCard({ headlines }: { headlines: string[] }) {
  const [text, setText] = useState<string | null>(() => loadCachedBriefing());
  const [loading, setLoading] = useState(!text);

  const identity = getAIIdentity();

  useEffect(() => {
    if (text) return;

    const generate = async () => {
      setLoading(true);

      try {
        const res = await fetchPreloadedSummaries(
          headlines.slice(0, 5).map((h, i) => ({
            id: `brief-${i}`,
            title: h,
            description: h,
            url: "",
            author: "system",
            image: "",
            language: "en",
            category: ["Top"],
            published: new Date().toISOString(),
          }))
        );

        const joined = Object.values(res || {})
          .flat()
          .join(" ")
          .trim();

        const finalText = joined
          ? `Hi ${identity}. ${joined}`
          : `Hi ${identity}. Today’s feed is moving fast — key stories are unfolding across global markets, governance, and technology.`;

        setText(finalText);
        saveBriefing(finalText);
      } catch {
        const fallback = `Hi ${identity}. Your news feed is active, with global developments updating in real time.`;
        setText(fallback);
        saveBriefing(fallback);
      } finally {
        setLoading(false);
      }
    };

    generate();
  }, [headlines]);

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        AI Briefing
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Composing your briefing...
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-foreground/90">
          {text}
        </p>
      )}
    </div>
  );
}
