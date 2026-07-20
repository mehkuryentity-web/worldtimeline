import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, Loader2, Flame } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { NewsCard } from "@/components/NewsCard";
import { TrendingLoader } from "@/components/TrendingLoader";
import { getNews, searchNews, getTrendingKeywords } from "@/lib/news";
import { cacheArticles, type NewsItem } from "@/lib/mock-news";

export const Route = createFileRoute("/trending")({
  head: () => ({
    meta: [
      { title: "Trending · WorldTimeline" },
      { name: "description", content: "Viral news worldwide and what people are searching for right now." },
    ],
  }),
  component: TrendingPage,
});

// Fallback only -- shown while getTrendingKeywords() is loading, or on the
// rare occasion the archive doesn't yet have 2+ repeats of anything (cold
// start / freshly cleared cache). Once real keywords come back they replace
// this list entirely.
const FALLBACK_SUGGESTIONS = [
  "Iran nuclear deal",
  "AI safety bill",
  "COP draft",
  "elections 2026",
  "ceasefire talks",
  "JWST discovery",
  "cloud outage",
  "Bitcoin price",
  "Champions League",
  "Taylor Swift",
];

function byRecencyDesc(a: NewsItem, b: NewsItem) {
  return +new Date(b.publishedAt) - +new Date(a.publishedAt);
}

function TrendingPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  // Real trending topics, computed server-side from recurring names/places
  // in recent archive headlines -- see get-trending-keywords edge function.
  const keywords = useQuery({
    queryKey: ["trending-keywords"],
    queryFn: getTrendingKeywords,
    staleTime: 10 * 60 * 1000,
  });
  const suggestions = keywords.data && keywords.data.length > 0 ? keywords.data : FALLBACK_SUGGESTIONS;

  // Viral feed: Top global headlines, sorted by recency.
  const viral = useQuery({
    queryKey: ["trending-viral"],
    queryFn: () => getNews("Top", "GLOBAL"),
    staleTime: 5 * 60 * 1000,
  });

  // Real archive search -- backs both the search box and the chip clicks.
  const search = useQuery({
    queryKey: ["trending-search", debounced.toLowerCase()],
    queryFn: () => searchNews(debounced),
    enabled: debounced.length > 1,
    staleTime: 5 * 60 * 1000,
  });

  const viralItems = useMemo(() => [...(viral.data ?? [])].sort(byRecencyDesc), [viral.data]);
  const searchItems = useMemo(() => [...(search.data ?? [])].sort(byRecencyDesc), [search.data]);

  useEffect(() => {
    if (viralItems.length) cacheArticles(viralItems);
  }, [viralItems]);
  useEffect(() => {
    if (searchItems.length) cacheArticles(searchItems);
  }, [searchItems]);

  const showSearch = debounced.length > 1;

  // First-ever load of the viral feed (no cached data yet) — show the
  // animated preloader instead of an empty page.
  if (viral.isLoading) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <TopBar />
        <TrendingLoader />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />
      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2.5 focus-within:border-primary">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search trending topics…"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          {(search.isFetching || (viral.isFetching && !showSearch)) && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Trending searches
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((t) => (
              <button
                key={t}
                onClick={() => setQ(t)}
                className="rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs text-foreground/90 hover:border-primary hover:text-primary"
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {showSearch ? (
          <section className="space-y-3">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Results for “{debounced}”
            </h2>
            {!search.isFetching && searchItems.length === 0 && (
              <p className="rounded-xl border border-border bg-surface-1 px-4 py-6 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
                No matches
              </p>
            )}
            {searchItems.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Flame className="h-3 w-3 text-breaking" />
              Viral right now
            </h2>
            {viralItems.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </section>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
