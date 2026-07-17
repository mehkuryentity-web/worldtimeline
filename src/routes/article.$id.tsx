import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, MessageCircle, Sparkles } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { ReactionBar } from "@/components/ReactionBar";
import { getCachedArticle, cacheArticles, type NewsItem, type Category } from "@/lib/mock-news";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/article/$id")({
  component: ArticlePage,
});

const KEY = "wt_summary_v4";

interface StoredSummary {
  lines: string[];
  hook: string | null;
}

function load(id: string): StoredSummary | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw)[id] : null;
  } catch {
    return null;
  }
}

function save(id: string, data: StoredSummary) {
  try {
    const raw = localStorage.getItem(KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[id] = data;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

// ─── Fallback fetch (cache miss) ──────────────────────────────────────────
// The feed only populates the local article cache as it renders cards, so
// a shared link, deep link, or a refresh landing straight on /article/$id
// finds nothing there. get-news mints each item's id from its own url
// column (id: r.url), so a direct lookup by url on news_archive recovers
// the exact same article -- no new edge function needed.
async function fetchArticleByUrl(url: string): Promise<NewsItem | null> {
  try {
    const { data, error } = await supabase
      .from("news_archive")
      .select("url, title, summary, image, author, category, country, published_at")
      .eq("url", url)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.url,
      category: (data.category as Category) || "Top",
      title: data.title,
      source: data.author || "News",
      region: data.country || "GLOBAL",
      publishedAt: data.published_at,
      summary: data.summary || "",
      url: data.url,
      image: data.image || undefined,
    };
  } catch {
    return null;
  }
}

// ─── Summary preloader ─────────────────────────────────────────────────────
// Same visual language as the Xplore Matches radar preloader (pulsing rings
// around a centered icon + a cycling status line + skeleton blocks) so the
// wait for a summary doesn't read as a stall -- just tailored to a single
// article instead of four categories.
const SUMMARY_STEPS = ["Reading the article", "Pulling out the key facts", "Writing the recap"];

function ArticleSummaryPreloader() {
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCycle((c) => c + 1), 1300);
    return () => clearInterval(id);
  }, []);

  const activeLabel = SUMMARY_STEPS[cycle % SUMMARY_STEPS.length];

  return (
    <div className="flex flex-col items-center py-6">
      <div className="relative h-14 w-14 flex-shrink-0">
        <span className="absolute inset-0 rounded-full border-2 border-primary/40 animate-ping" />
        <span className="absolute inset-2 rounded-full border-2 border-primary/30 animate-ping [animation-delay:250ms]" />
        <span className="absolute inset-4 rounded-full border-2 border-primary/20 animate-ping [animation-delay:500ms]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
      </div>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{activeLabel}</span>&hellip;
      </p>

      <div className="mt-2 flex gap-1.5">
        {SUMMARY_STEPS.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              i === cycle % SUMMARY_STEPS.length ? "bg-primary" : "bg-border animate-pulse"
            }`}
          />
        ))}
      </div>

      <div className="mt-6 w-full space-y-2">
        <div className="h-3 w-full rounded bg-surface-1 border border-border animate-pulse" />
        <div className="h-3 w-11/12 rounded bg-surface-1 border border-border animate-pulse" style={{ animationDelay: "120ms" }} />
        <div className="h-3 w-full rounded bg-surface-1 border border-border animate-pulse" style={{ animationDelay: "240ms" }} />
        <div className="h-3 w-4/5 rounded bg-surface-1 border border-border animate-pulse" style={{ animationDelay: "360ms" }} />
        <div className="h-3 w-full rounded bg-surface-1 border border-border animate-pulse" style={{ animationDelay: "480ms" }} />
        <div className="h-3 w-3/5 rounded bg-surface-1 border border-border animate-pulse" style={{ animationDelay: "600ms" }} />
      </div>
    </div>
  );
}

export function ArticlePage() {
  const { id } = Route.useParams();
  const router = useRouter();

  const goBack = () => {
    // history.back() is a POP navigation, which is what the router's
    // scrollRestoration actually tracks -- Link to="/" was a PUSH (a fresh
    // visit), which always lands at the top regardless of where the user
    // scrolled to before opening this article.
    if (window.history.length > 1) {
      router.history.back();
    } else {
      // Deep-linked straight into this article (no prior in-app page) --
      // nothing to go back to, so fall back to a normal visit to the feed.
      router.navigate({ to: "/" });
    }
  };

  const [item, setItem] = useState<NewsItem | null>(() => getCachedArticle(id));
  const [itemLoading, setItemLoading] = useState(() => !getCachedArticle(id));
  const [itemNotFound, setItemNotFound] = useState(false);
  const [lines, setLines] = useState<string[]>(() => load(id)?.lines ?? []);
  const [hook, setHook] = useState<string | null>(() => load(id)?.hook ?? null);
  const [loading, setLoading] = useState(false);
  // Bumping this forces ReactionBar to remount with comments pre-opened --
  // it only reads defaultCommentsOpen on its own initial mount, so a plain
  // prop change wouldn't reopen it on its own.
  const [commentsKey, setCommentsKey] = useState(0);
  const [commentsOpenOnMount, setCommentsOpenOnMount] = useState(false);

  const jumpToComments = () => {
    setCommentsOpenOnMount(true);
    setCommentsKey((k) => k + 1);
    document.getElementById("article-reaction-bar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Cache miss -- go fetch the article directly by its url (its id) instead
  // of silently rendering nothing.
  useEffect(() => {
    if (item) return;

    let cancelled = false;
    (async () => {
      const fetched = await fetchArticleByUrl(id);
      if (cancelled) return;

      if (fetched) {
        cacheArticles([fetched]);
        setItem(fetched);
      } else {
        setItemNotFound(true);
      }
      setItemLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, item]);

  useEffect(() => {
    if (!item) return;
    if (lines.length) return;

    (async () => {
      setLoading(true);

      const { data } = await supabase.functions.invoke("article-summary", {
        body: {
          id: item.id,
          title: item.title,
          content: item.summary,
          url: item.url,
        },
      });

      const out = data?.lines;
      const outHook = typeof data?.hook === "string" ? data.hook : null;

      if (Array.isArray(out) && out.every((l) => typeof l === "string")) {
        setLines(out);
        setHook(outHook);
        save(item.id, { lines: out, hook: outHook });
      }

      setLoading(false);
    })();
  }, [id, item]);

  if (itemLoading) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <TopBar />
        <main className="mx-auto max-w-md px-4 pt-4 space-y-4">
          <button onClick={goBack} className="text-xs flex gap-1">
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
          <div className="space-y-2">
            <div className="h-5 w-full rounded bg-surface-1 border border-border animate-pulse" />
            <div className="h-5 w-4/5 rounded bg-surface-1 border border-border animate-pulse" />
          </div>
          <ArticleSummaryPreloader />
        </main>
        <BottomNav />
      </div>
    );
  }

  if (itemNotFound || !item) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <TopBar />
        <main className="mx-auto max-w-md px-4 pt-4 space-y-4">
          <button onClick={goBack} className="text-xs flex gap-1">
            <ArrowLeft className="h-3 w-3" /> Back
          </button>
          <div className="rounded-md border border-dashed border-border bg-surface-1 p-6 text-center text-sm text-muted-foreground">
            We couldn't find this article. It may have aged out of the archive.
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />

      <main className="mx-auto max-w-md px-4 pt-4 space-y-4">
        <button onClick={goBack} className="text-xs flex gap-1">
          <ArrowLeft className="h-3 w-3" /> Back
        </button>

        <h1 className="text-xl font-semibold">{item.title}</h1>

        {loading && !lines.length ? (
          <ArticleSummaryPreloader />
        ) : lines.length ? (
          <div className="space-y-2 text-sm leading-relaxed">
            {lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Summary unavailable
          </div>
        )}

        {item.url && item.url !== "#" && (
          <a href={item.url} target="_blank" className="text-xs text-primary">
            Read source <ExternalLink className="h-3 w-3 inline" />
          </a>
        )}

        {hook && (
          <button
            onClick={jumpToComments}
            className="flex w-full items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-left text-sm text-foreground transition hover:border-primary/60"
          >
            <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
            <span>{hook}</span>
          </button>
        )}

        <div id="article-reaction-bar">
          <ReactionBar
            key={commentsKey}
            item={item}
            showReadLink={false}
            defaultCommentsOpen={commentsOpenOnMount}
          />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
