import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { AISummaryCard } from "@/components/AISummaryCard";
import { CategoryTabs } from "@/components/CategoryTabs";
import { NewsCard } from "@/components/NewsCard";
import { Ticker } from "@/components/Ticker";
import { CATEGORIES, type Category, type NewsItem } from "@/lib/mock-news";
import { useAppState } from "@/hooks/use-app-state";
import { fetchLiveNews } from "@/lib/news.functions";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WorldTimeline — Real-time global news, intelligently summarized" },
      {
        name: "description",
        content:
          "High-speed personalized news aggregator. Live world events, AI briefings, event timelines, and rewards for engagement.",
      },
      { property: "og:title", content: "WorldTimeline — Real-time global news" },
      {
        property: "og:description",
        content:
          "Live world events, AI briefings, event timelines, and rewards for engagement.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const [category, setCategory] = useState<Category>("Top");
  const { award } = useAppState();
  const fetchNews = useServerFn(fetchLiveNews);

  useEffect(() => {
    award("open_app");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["news", category],
    queryFn: () => fetchNews({ data: { category } }),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60_000,
  });

  const items: NewsItem[] = (data?.items ?? []).map((n) => ({
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

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />
      <Ticker items={items.slice(0, 8).map((i) => i.title)} />
      <main className="mx-auto max-w-md space-y-4 px-4 pb-6 pt-4">
        <AISummaryCard headlines={items.slice(0, 6).map((i) => i.title)} />
        <CategoryTabs value={category} onChange={setCategory} />
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Global feed · live
          </h2>
          {data?.cached && (
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              cached
            </span>
          )}
        </div>
        {isLoading && items.length === 0 && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-1 py-10 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading global feed…
          </div>
        )}
        {(error || data?.error) && items.length === 0 && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
            Couldn't fetch live news. {data?.error ?? String(error)}
          </div>
        )}
        <div className="space-y-3">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
