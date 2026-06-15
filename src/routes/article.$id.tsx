import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Clock, ExternalLink, Loader2 } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { ReactionBar } from "@/components/ReactionBar";
import { getCachedArticle, type NewsItem } from "@/lib/mock-news";
import { timeAgo } from "@/lib/format";
import { useAppState } from "@/hooks/use-app-state";
import { microLabel, microLabelClass } from "@/lib/micro-label";
import { generateArticleSummary } from "@/lib/article-summary.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/article/$id")({
  head: () => ({
    meta: [
      { title: "Article · WorldTimeline" },
      { name: "description", content: "Read the full story with source attribution." },
    ],
  }),
  component: ArticlePage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-6 text-sm text-muted-foreground">Article not found.</div>
  ),
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
  } catch {
    /* ignore */
  }
}

function ArticlePage() {
  const { id } = Route.useParams();
  const { award } = useAppState();
  const [item, setItem] = useState<NewsItem | null>(() => getCachedArticle(id));
  const [lines, setLines] = useState<string[]>(() => loadCachedSummary(id) ?? []);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const callSummary = useServerFn(generateArticleSummary);

  useEffect(() => {
    setItem(getCachedArticle(id));
    setLines(loadCachedSummary(id) ?? []);
    award("read_summary");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!item) return;
    if (lines.length > 0) return;
    let cancelled = false;
    setLoadingSummary(true);
    setSummaryError(null);

    const payload = {
      id: item.id,
      title: item.title,
      summary: item.summary,
      source: item.source,
      url: item.url,
    };

    // Try the TanStack server function first (works on Lovable hosting where
    // LOVABLE_API_KEY is auto-injected). If it fails (e.g. on Vercel where
    // the env var isn't present), fall back to the Supabase Edge Function
    // which always has access to the key via Lovable Cloud secrets.
    const run = async () => {
      try {
        const res = await callSummary({ data: payload });
        return res.lines.filter(Boolean);
      } catch {
        const { data, error } = await supabase.functions.invoke("article-summary", {
          body: payload,
        });
        if (error) throw error;
        const out = (data as { lines?: string[] })?.lines ?? [];
        return out.filter(Boolean);
      }
    };

    run()
      .then((out) => {
        if (cancelled) return;
        setLines(out);
        if (out.length) saveCachedSummary(item.id, out);
      })
      .catch((e: Error) => {
        if (!cancelled) setSummaryError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingSummary(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!item) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <TopBar />
        <main className="mx-auto max-w-md px-4 pt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to feed
          </Link>
          <div className="mt-6 rounded-xl border border-border bg-surface-1 p-6 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            We couldn't find this story in the local cache. Open it at the source instead.
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  const hasSource = Boolean(item.url) && item.url !== "#";
  const label = microLabel(item);
  const fallback = item.summary;

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />
      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to feed
        </Link>

        <article className="overflow-hidden rounded-xl border border-border bg-surface-1">
          {item.image && (
            <img
              src={item.image}
              alt={item.title}
              className="aspect-[16/9] w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <div className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {label && (
                <span
                  className={`rounded-sm px-1.5 py-0.5 font-bold ${microLabelClass(label)}`}
                >
                  {label}
                </span>
              )}
              <span className="text-primary">{item.category}</span>
              <span>·</span>
              <span>{item.source}</span>
              <span>·</span>
              <span>{item.region}</span>
              <span className="ml-auto flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo(item.publishedAt)}
              </span>
            </div>
            <h1 className="text-xl font-semibold leading-tight tracking-tight">
              {item.title}
            </h1>

            {loadingSummary && lines.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-background/30 p-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Writing a friendly recap of this story…
              </div>
            ) : lines.length > 0 ? (
              <div className="space-y-2.5 text-sm leading-relaxed text-foreground/90">
                {lines.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-foreground/90">{fallback}</p>
            )}

            {summaryError && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-destructive">
                Couldn't generate a recap — showing source summary instead.
              </p>
            )}

            {hasSource && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => award("read_article")}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-primary-foreground"
              >
                Read full article at source
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <ReactionBar item={item} showReadLink={false} defaultCommentsOpen />
        </article>
      </main>
      <BottomNav />
    </div>
  );
}
