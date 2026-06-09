import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { NewsCard } from "@/components/NewsCard";
import { MOCK_NEWS } from "@/lib/mock-news";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search · WorldTimeline" },
      { name: "description", content: "Search global news across categories, regions, and sources." },
    ],
  }),
  component: SearchPage,
});

const TRENDING = ["AI safety bill", "COP draft", "BOJ yen", "ceasefire Doha", "JWST water", "cloud outage"];

function SearchPage() {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const needle = q.toLowerCase();
    return MOCK_NEWS.filter(
      (n) =>
        n.title.toLowerCase().includes(needle) ||
        n.summary.toLowerCase().includes(needle) ||
        n.source.toLowerCase().includes(needle) ||
        n.category.toLowerCase().includes(needle) ||
        n.region.toLowerCase().includes(needle),
    );
  }, [q]);

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
            placeholder="Search the world…"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
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

        <div className="space-y-3">
          {q && results.length === 0 && (
            <p className="rounded-xl border border-border bg-surface-1 px-4 py-6 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
              No matches for "{q}"
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
