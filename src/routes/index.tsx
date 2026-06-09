import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { AISummaryCard } from "@/components/AISummaryCard";
import { CategoryTabs } from "@/components/CategoryTabs";
import { NewsCard } from "@/components/NewsCard";
import { Ticker } from "@/components/Ticker";
import { MOCK_NEWS, type Category } from "@/lib/mock-news";
import { useAppState } from "@/hooks/use-app-state";

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

  useEffect(() => {
    award("open_app");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const list = category === "Top" ? MOCK_NEWS : MOCK_NEWS.filter((n) => n.category === category);
    return [...list].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  }, [category]);

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />
      <Ticker />
      <main className="mx-auto max-w-md space-y-4 px-4 pb-6 pt-4">
        <AISummaryCard />
        <CategoryTabs value={category} onChange={setCategory} />
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Global feed · sourced
        </h2>
        <div className="space-y-3">
          {filtered.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
