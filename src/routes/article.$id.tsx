import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, ExternalLink, Loader2 } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { ReactionBar } from "@/components/ReactionBar";
import { getCachedArticle, type NewsItem } from "@/lib/mock-news";
import { timeAgo } from "@/lib/format";
import { useAppState } from "@/hooks/use-app-state";
import { microLabel, microLabelClass } from "@/lib/micro-label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/article/$id")({
  head: () => ({
    meta: [
      { title: "Article · WorldTimeline" },
      { name: "description", content: "Read the full story with source attribution." },
    ],
  }),
  component: ArticlePage,
});

const SUMMARY_CACHE_KEY = "wt:ai-summary:v1";

function loadCachedSummary(id: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SUMMARY_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string[]>;
    return map[id] ?? null;
  } catch {
    return null;
  }
}

function saveCachedSummary(id: string, lines: string[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SUMMARY_CACHE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    map[id] = lines;
    localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify(map));
  } catch {}
}

export function ArticlePage() {
  const { id } = Route.useParams();
  const { award } = useAppState();

  const [item, setItem] = useState<NewsItem | null>(() => getCachedArticle(id));
  const [lines, setLines] = useState<string[]>(() => loadCachedSummary(id) ?? []);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    const freshItem = getCachedArticle(id);
    setItem(freshItem);

    const cached = loadCachedSummary(id);

    if (cached?.length) {
      setLines(cached);
      return;
    }

    if (freshItem) {
      fetchSummary(freshItem);
    }

    award("read_summary");
  }, [id]);

  const fetchSummary = async (targetItem: NewsItem) => {
    setLoadingSummary(true);
    setSummaryError(null);

    let timeout: any;

    try {
      timeout = setTimeout(() => {
        setLoadingSummary(false);
        setSummaryError("Summary request timed out.");
      }, 12000);

      const { data, error } = await supabase.functions.invoke(
        "article-summary",
        {
          body: {
            id: targetItem.id,
            title: targetItem.title,
            content: targetItem.summary,
            source: targetItem.source,
            url: targetItem.url,
          },
        }
      );

      clearTimeout(timeout);

      if (error) throw error;

      const text = data?.lines?.[0];

      if (text) {
        setLines([text]);
        saveCachedSummary(targetItem.id, [text]);
      } else {
        setSummaryError("Empty summary returned.");
      }
    } catch (err) {
      clearTimeout(timeout);
      setSummaryError("Failed to generate summary.");
    } finally {
      setLoadingSummary(false);
    }
  };

  if (!item) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <TopBar />
        <main className="mx-auto max-w-md px-4 pt-6">
          <Link to="/" className="text-xs uppercase">
            <ArrowLeft className="h-3 w-3 inline" /> Back
          </Link>

          <div className="mt-6 text-xs text-muted-foreground">
            Article not found.
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const hasSource = Boolean(item.url) && item.url !== "#";
  const label = microLabel(item);

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        <Link to="/" className="text-xs uppercase">
          <ArrowLeft className="h-3 w-3 inline" /> Back
        </Link>

        <article className="rounded-xl border border-border bg-surface-1">
          {item.image && (
            <img
              src={item.image}
              alt={item.title}
              className="aspect-[16/9] w-full object-cover"
            />
          )}

          <div className="p-4 space-y-3">
            <div className="flex text-[10px] uppercase gap-2 text-muted-foreground">
              <span className="text-primary">{item.category}</span>
              <span>{item.source}</span>
              <span>{item.region}</span>
              <span className="ml-auto flex items-center gap-1">
                <Clock className="h-3 w-3" /> {timeAgo(item.publishedAt)}
              </span>
            </div>

            <h1 className="text-xl font-semibold">{item.title}</h1>

            {/* SUMMARY UI */}
            {lines.length > 0 ? (
              <p className="text-sm leading-relaxed text-foreground/90">
                {lines[0]}
              </p>
            ) : loadingSummary ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Generating summary...
              </div>
            ) : summaryError ? (
              <div className="text-xs text-red-400">{summaryError}</div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Preparing article...
              </div>
            )}

            {hasSource && (
              <a
                href={item.url}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs uppercase bg-primary text-white px-3 py-2 rounded"
              >
                Read Source <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <ReactionBar item={item} showReadLink={false} />
        </article>
      </main>

      <BottomNav />
    </div>
  );
}
