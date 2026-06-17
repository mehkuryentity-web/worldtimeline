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

import {
  CATEGORIES,
  type Category,
  type NewsItem,
  cacheArticles,
} from "@/lib/mock-news";

import { findCountry } from "@/lib/countries";
import { useAppState } from "@/hooks/use-app-state";
import { Loader2, Timer } from "lucide-react";

import { fetchPreloadedSummaries } from "@/lib/news.functions";
import { enqueueArticles } from "@/lib/intelligence/preloadEngine";

export const Route = createFileRoute("/")({
  component: Home,
});

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
  fetchedAt: string;
  country: string;
  category: string;
  error?: string;
}

async function fetchNews(category: Category, country: string): Promise<NewsResponse> {
  const res = await fetch(
    `/api/news?category=${encodeURIComponent(category)}&country=${encodeURIComponent(country)}`
  );
  return res.json();
}

const normalizeCategory = (cat: string): Category => {
  const found = CATEGORIES.find(
    (c) => c.toLowerCase() === cat.toLowerCase()
  );
  return found ?? "Top";
};

function Home() {
  const [category, setCategory] = useState<Category>("Top");

  const { state, award, update } = useAppState();

  const [country, setCountryState] = useState<string>(
    () => state.country ?? "GLOBAL"
  );

  const [refreshMs, setRefreshMs] = useState<number>(5 * 60 * 1000);

  const preloadedBatchesRef = useRef<Set<string>>(new Set());

  const countryMeta = findCountry(country);

  const setCountry = (code: string) => {
    setCountryState(code);
    update((s) => ({ ...s, country: code }));
  };

  useEffect(() => {
    award("open_app");
  }, []);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["news", country, category],
    queryFn: () => fetchNews(category, country),
    refetchInterval: refreshMs > 0 ? refreshMs : false,
    staleTime: 5 * 60 * 1000,
  });

  const apiItems: NewsItem[] = (data?.items ?? []).map((n) => ({
    id: n.id,
    category: normalizeCategory(n.category),
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
      category: normalizeCategory(p.category),
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
      ? allItems.filter(
          (i) => now - +new Date(i.publishedAt) <= refreshMs
        )
      : allItems;

  useEffect(() => {
    if (allItems.length) {
      cacheArticles(allItems);
    }
  }, [data?.fetchedAt, state.userPosts.length]);

  /*
   * =========================================================
   * STEP 5 FIX: BACKGROUND PRELOAD TRIGGER (CORE FIX)
   * =========================================================
   */
  useEffect(() => {
    if (!items.length) return;

    // 1. PRELOAD EDGE SUMMARIES (BATCHED)
    const batch = items.slice(0, 12);
    const batchKey = batch.map((b) => b.id).join(",");

    if (!preloadedBatchesRef.current.has(batchKey)) {
      preloadedBatchesRef.current.add(batchKey);

      const formatted = batch.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.summary ?? "",
        url: item.url ?? "",
        author: item.source ?? "",
        image: item.image ?? "",
        language: "en",
        category: [item.category],
        published: item.publishedAt,
      }));

      fetchPreloadedSummaries(formatted)
        .then((res) => {
          if (!res) return;

          const CACHE_KEY = "wt:ai-summary:v2";

          try {
            const existing = localStorage.getItem(CACHE_KEY);
            const map = existing ? JSON.parse(existing) : {};

            Object.entries(res).forEach(([id, value]) => {
              map[id] = value;
            });

            localStorage.setItem(CACHE_KEY, JSON.stringify(map));
          } catch {}
        })
        .catch(() => {});
    }

    // 2. PRELOAD INTELLIGENCE ENGINE (NEW V2 LAYER)
    enqueueArticles(items.slice(0, 12));
  }, [items]);

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />

      <Ticker items={items.slice(0, 8).map((i) => i.title)} />

      <main className="mx-auto max-w-md space-y-4 px-4 pb-6 pt-4">
        <AISummaryCard headlines={items.slice(0, 6).map((i) => i.title)} />

        <div className="flex items-center justify-between gap-2">
          <CountrySelector value={country} onChange={setCountry} />

          <div className="flex items-center gap-2">
            <Timer className="h-3 w-3" />
            <select
              value={refreshMs}
              onChange={(e) => setRefreshMs(Number(e.target.value))}
              className="text-xs border rounded px-2 py-1"
            >
              <option value={300000}>5 min</option>
              <option value={600000}>10 min</option>
              <option value={1800000}>30 min</option>
              <option value={3600000}>1 hour</option>
              <option value={0}>Off</option>
            </select>
          </div>
        </div>

        <CategoryTabs value={category} onChange={setCategory} />

        <h2 className="text-[10px] uppercase text-muted-foreground">
          {countryMeta.flag} {countryMeta.name} · {category}
        </h2>

        {isLoading && items.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading feed...
          </div>
        )}

        {(error as any) && (
          <div className="text-xs text-red-500">
            Failed to load news
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
