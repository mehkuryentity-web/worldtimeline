import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { NewsCard } from "@/components/NewsCard";
import { CATEGORIES, type Category, type NewsItem, cacheArticles } from "@/lib/mock-news";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search · WorldTimeline" },
      { name: "description", content: "Search global news across categories, regions, and sources." },
    ],
  }),
  component: SearchPage,
});

const TRENDING = ["AI safety bill", "COP draft", "elections", "ceasefire", "JWST", "cloud outage"];

interface ApiNewsItem {
  id: string;
  category: string;
  title: string;
  source: string;
  region: string;
  publishedAt: string;
  summary: string;
  url: string;
  image?: string;
}
interface NewsResponse {
  items: ApiNewsItem[];
  cached: boolean;
  error?: string;
}

async function searchProxy(q: string): Promise<NewsResponse> {
  const res = await fetch(`/api/news?q=${encodeURIComponent(q)}&category=Top&country=GLOBAL`);
  return (await res.json()) as NewsResponse;
}

function SearchPage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounce keystrokes so we don't hammer the proxy per character.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ["search", debounced.toLowerCase()],
    queryFn: () => searchProxy(debounced),
    enabled: debounced.length > 1,
    // Cached on the server for 5 min; mirror on the client.
    staleTime: 5 * 60 * 1000,
  });

  const results: NewsItem[] = useMemo(() => {
    const list = (data?.items ?? []).map((n) => ({
      id: n.id,
      category: (CATEGORIES.includes(n.category as Category) ? n.category : "Top") as Category,
      title: n.title,
      source: n.source,
      region: n.region,
      publishedAt: n.publishedAt,
      summary: n.summary,
      url: n.url,
      image: n.image,
    }));
    return list.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  }, [data]);

  useEffect(() => {
    if (results.length) cacheArticles(results);
  }, [results]);

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />
      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2.5 focus-within:border-primary">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search world news…"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>

        {!q && (
          <section>
            <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Trending now
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {TRENDING.map((t) => (
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
        )}

        {data?.cached && results.length > 0 && (
          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            · served from cache
          </p>
        )}

        <div className="space-y-3">
          {debounced.length > 1 && !isFetching && results.length === 0 && (
            <p className="rounded-xl border border-border bg-surface-1 px-4 py-6 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
              No matches for "{debounced}"
            </p>
          )}
          {results.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
