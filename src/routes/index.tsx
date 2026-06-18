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
import { Loader2 } from "lucide-react";

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

async function fetchNews(category: Category, country: string) {
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

  const [mode, setMode] = useState<
    "off" | "5m" | "10m" | "30m" | "1h" | "24h" | "custom"
  >("off");

  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(0);

  const getWindowMs = () => {
    switch (mode) {
      case "5m":
        return 5 * 60 * 1000;
      case "10m":
        return 10 * 60 * 1000;
      case "30m":
        return 30 * 60 * 1000;
      case "1h":
        return 60 * 60 * 1000;
      case "24h":
        return 24 * 60 * 60 * 1000;
      case "custom":
        return (customHours * 60 + customMinutes) * 60 * 1000;
      default:
        return 0;
    }
  };

  const refreshMs = getWindowMs();

  const preloadedBatchesRef = useRef<Set<string>>(new Set());
  const countryMeta = findCountry(country);

  const setCountry = (code: string) => {
    setCountryState(code);
    update((s) => ({ ...s, country: code }));
  };

  useEffect(() => {
    award("open_app");
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["news", country, category],
    queryFn: () => fetchNews(category, country),
    refetchInterval: false,
    staleTime: 0,
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

  const allItems = [...userItems, ...apiItems];

  const now = Date.now();

  // -----------------------------
  // 🧠 SMART RECENCY ENGINE
  // -----------------------------
  const scoredItems = allItems.map((item) => {
    const age = now - +new Date(item.publishedAt);

    // freshness score (higher = newer)
    const freshnessScore = Math.max(0, 1 - age / (24 * 60 * 60 * 1000));

    return {
      ...item,
      _score: freshnessScore,
    };
  });

  let items: NewsItem[] = [];

  if (mode === "off") {
    // 🧠 SMART MODE: no filtering, just intelligent ranking
    items = scoredItems
      .sort((a, b) => b._score - a._score)
      .map(({ _score, ...rest }) => rest);
  } else {
    // 🧹 HARD FILTER MODE (user-controlled)
    items = scoredItems
      .filter((i) => now - +new Date(i.publishedAt) <= refreshMs)
      .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
      .map(({ _score, ...rest }) => rest);
  }

  useEffect(() => {
    if (allItems.length) cacheArticles(allItems);
  }, [data?.fetchedAt, state.userPosts.length]);

  useEffect(() => {
    if (!items.length) return;

    const batch = items.slice(0, 12);
    const key = batch.map((b) => b.id).join(",");

    if (!preloadedBatchesRef.current.has(key)) {
      preloadedBatchesRef.current.add(key);

      fetchPreloadedSummaries(
        batch.map((i) => ({
          id: i.id,
          title: i.title,
          description: i.summary ?? "",
          url: i.url ?? "",
          author: i.source ?? "",
          image: i.image ?? "",
          language: "en",
          category: [i.category],
          published: i.publishedAt,
        }))
      ).catch(() => {});

      enqueueArticles(items.slice(0, 12));
    }
  }, [items]);

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />

      <Ticker items={items.slice(0, 8).map((i) => i.title)} />

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4 pb-6">
        <AISummaryCard headlines={items.slice(0, 6).map((i) => i.title)} />

        <div className="flex items-center justify-between gap-2">
          <CountrySelector value={country} onChange={setCountry} />

          <div className="flex flex-col gap-1">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="text-xs border rounded px-2 py-1"
            >
              <option value="off">Smart (Off)</option>
              <option value="5m">5 min</option>
              <option value="10m">10 min</option>
              <option value="30m">30 min</option>
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
              <option value="custom">Custom</option>
            </select>

            {mode === "custom" && (
              <div className="flex gap-1">
                <input
                  type="number"
                  value={customHours}
                  onChange={(e) => setCustomHours(Number(e.target.value))}
                  className="w-12 text-xs border rounded px-1"
                  placeholder="h"
                />
                <input
                  type="number"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(Number(e.target.value))}
                  className="w-12 text-xs border rounded px-1"
                  placeholder="m"
                />
              </div>
            )}
          </div>
        </div>

        <CategoryTabs value={category} onChange={setCategory} />

        <h2 className="text-[10px] uppercase text-muted-foreground">
          {countryMeta.flag} {countryMeta.name} · {category}
        </h2>

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading feed...
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
