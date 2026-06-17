import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { AISummaryCard } from "@/components/AISummaryCard";
import { CategoryTabs } from "@/components/CategoryTabs";
import { CountrySelector } from "@/components/CountrySelector";
import { NewsCard } from "@/components/NewsCard";
import { Ticker } from "@/components/Ticker";
import { CATEGORIES, type Category, type NewsItem, cacheArticles } from "@/lib/mock-news";
import { findCountry } from "@/lib/countries";
import { useAppState } from "@/hooks/use-app-state";
import { Loader2, Timer } from "lucide-react";
import { fetchPreloadedSummaries } from "@/lib/news.functions";

export const Route = createFileRoute("/")({
  component: Home,
});

const SUMMARY_CACHE_KEY = "wt:ai-summary:v1";

function saveToGlobalCache(id: string, summary: string) {
  try {
    const raw = localStorage.getItem(SUMMARY_CACHE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[id] = [summary];
    localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify(map));
  } catch {}
}

function Home() {
  const [category, setCategory] = useState<Category>("Top");
  const { state, award, update } = useAppState();

  const [country, setCountryState] = useState<string>(() => state.country ?? "GLOBAL");
  const [refreshMs, setRefreshMs] = useState<number>(5 * 60 * 1000);

  const preloadedBatchesRef = useRef<Set<string>>(new Set());

  const countryMeta = findCountry(country);

  const setCountry = (code: string) => {
    setCountryState(code);
    update((s) => ({ ...s, country: code }));
  };

  useEffect(() => {
    award("open_app");

    if (!state.country) {
      fetch("/api/geo")
        .then((r) => r.json())
        .then((d: { country: string | null }) => {
          if (d.country && findCountry(d.country).code === d.country) {
            setCountry(d.country);
          }
        })
        .catch(() => {});
    }
  }, []);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["news", country, category],
    queryFn: async () => {
      const res = await fetch(
        `/api/news?category=${encodeURIComponent(category)}&country=${encodeURIComponent(country)}`
      );
      return res.json();
    },
    refetchInterval: refreshMs > 0 ? refreshMs : false,
    staleTime: 5 * 60 * 1000,
  });

  const apiItems: NewsItem[] = (data?.items ?? []).map((n: any) => ({
    id: n.id,
    category: CATEGORIES.includes(n.category) ? n.category : "Top",
    title: n.title,
    source: n.source,
    region: n.region,
    publishedAt: n.publishedAt,
    summary: n.summary,
    url: n.url,
    image: n.image,
  }));

  const userItems: NewsItem[] = (state.userPosts ?? [])
    .filter((p) => category === "Top" || p.category === category)
    .map((p) => ({
      id: p.id,
      category: CATEGORIES.includes(p.category) ? p.category : "Top",
      title: p.title,
      source: "Community",
      region: p.region || "Community",
      publishedAt: p.publishedAt,
      summary: p.summary,
      url: "#",
      image: p.media?.find((m) => m.type === "image")?.dataUrl,
    }));

  const allItems: NewsItem[] = [...userItems, ...apiItems].sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)
  );

  const now = Date.now();
  const items =
    refreshMs > 0
      ? allItems.filter((i) => now - +new Date(i.publishedAt) <= refreshMs)
      : allItems;

  useEffect(() => {
    if (allItems.length) cacheArticles(allItems);
  }, [data?.fetchedAt, state.userPosts.length]);

  // 🚀 FIXED PRELOADER: now persists to localStorage (REAL preload)
  useEffect(() => {
    if (!items.length) return;

    const batch = items.slice(0, 10);
    const batchKey = batch.map((b) => b.id).join(",");

    if (preloadedBatchesRef.current.has(batchKey)) return;
    preloadedBatchesRef.current.add(batchKey);

    const formatted = batch.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.summary,
      url: item.url,
      author: item.source,
      image: item.image,
      language: "en",
      category: [item.category],
      published: item.publishedAt,
    }));

    fetchPreloadedSummaries(formatted)
      .then((res) => {
        if (!res) return;

        Object.entries(res).forEach(([id, summary]) => {
          saveToGlobalCache(id, summary as string);
        });
      })
      .catch(() => {});
  }, [items]);

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />

      <Ticker items={items.slice(0, 8).map((i) => i.title)} />

      <main className="mx-auto max-w-md space-y-4 px-4 pb-6 pt-4">
        <AISummaryCard headlines={items.slice(0, 6).map((i) => i.title)} />

        <div className="flex items-center justify-between gap-2">
          <CountrySelector value={country} onChange={setCountry} />
        </div>

        <CategoryTabs value={category} onChange={setCategory} />

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
