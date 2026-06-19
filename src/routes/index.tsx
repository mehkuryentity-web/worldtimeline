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

type TimeMode =
  | number
  | "all"
  | { hours: string; minutes: string };

function Home() {
  const [category, setCategory] = useState<Category>("Top");
  const { state, award, update } = useAppState();

  const [country, setCountryState] = useState<string>(
    () => state.country ?? "GLOBAL"
  );

  // DEFAULT = ALL NEWS
  const [timeMode, setTimeMode] = useState<TimeMode>("all");

  const [customInput, setCustomInput] = useState({
    hours: "",
    minutes: "",
  });

  const preloadedBatchesRef = useRef<Set<string>>(new Set());
  const countryMeta = findCountry(country);

  const setCountry = (code: string) => {
    setCountryState(code);
    update((s) => ({ ...s, country: code }));
  };

  useEffect(() => {
    award("open_app");
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["news", country, category],
    queryFn: async () => {
      const res = await fetch(
        `/api/news?category=${encodeURIComponent(category)}&country=${encodeURIComponent(country)}`
      );
      return res.json();
    },
    refetchInterval: false,
    staleTime: 5 * 60 * 1000,
  });

  const apiItems: NewsItem[] = (data?.items ?? []).map((n: ApiNewsItem) => ({
    id: n.id,
    category: n.category as Category,
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
      category: p.category,
      title: p.title,
      source: "Community",
      region: p.region || "Community",
      publishedAt: p.publishedAt,
      summary: p.summary,
      url: "#",
      image: p.media?.find((m) => m.type === "image")?.dataUrl,
    }));

  const allItems: NewsItem[] = [...userItems, ...apiItems];

  const now = Date.now();

  // ---------------------------
  // RESOLVE WINDOW
  // ---------------------------
  let windowMs = 0;

  if (typeof timeMode === "number") {
    windowMs = timeMode;
  } else if (timeMode !== "all") {
    windowMs =
      Number(timeMode.hours || 0) * 3600000 +
      Number(timeMode.minutes || 0) * 60000;
  }

  const isAllNews = timeMode === "all";

  let items: NewsItem[] = [];

  // ---------------------------
  // ALL NEWS MODE
  // newest → oldest
  // ---------------------------
  if (isAllNews) {
    items = [...allItems].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    );
  }

  // ---------------------------
  // TIME FILTER MODE
  // oldest → newest within window
  // ---------------------------
  else {
    const filtered = allItems.filter((item) => {
      const age = now - new Date(item.publishedAt).getTime();
      return age <= windowMs;
    });

    items = filtered.sort(
      (a, b) =>
        new Date(a.publishedAt).getTime() -
        new Date(b.publishedAt).getTime()
    );
  }

  // ---------------------------
  // PRELOAD ENGINE
  // ---------------------------
  useEffect(() => {
    if (!items.length) return;

    cacheArticles(items);

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

  const showCustom = timeMode !== "all" && typeof timeMode !== "number";

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />

      <Ticker items={items.slice(0, 8).map((i) => i.title)} />

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4 pb-6">
        <AISummaryCard headlines={items.slice(0, 6).map((i) => i.title)} />

        {/* TIME SELECTOR */}
        <div className="flex items-center justify-between gap-2">
          <CountrySelector value={country} onChange={setCountry} />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Timer className="h-3 w-3" />

              <select
                value={
                  timeMode === "all"
                    ? "all"
                    : typeof timeMode === "number"
                    ? timeMode
                    : "custom"
                }
                onChange={(e) => {
                  const v = e.target.value;

                  if (v === "all") {
                    setTimeMode("all");
                  } else if (v === "custom") {
                    setTimeMode({ hours: "", minutes: "" });
                  } else {
                    setTimeMode(Number(v));
                  }
                }}
                className="text-xs border rounded px-2 py-1"
              >
                <option value="all">All News</option>
                <option value={300000}>5 min</option>
                <option value={600000}>10 min</option>
                <option value={1800000}>30 min</option>
                <option value={3600000}>1 hour</option>
                <option value={86400000}>24 hours</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* CUSTOM RANGE */}
            {showCustom && (
              <div className="flex gap-2">
                <input
                  className="border px-2 py-1 text-xs w-20"
                  placeholder="hrs"
                  value={(timeMode as any).hours}
                  onChange={(e) =>
                    setTimeMode((prev: any) => ({
                      ...prev,
                      hours: e.target.value,
                    }))
                  }
                />

                <input
                  className="border px-2 py-1 text-xs w-20"
                  placeholder="min"
                  value={(timeMode as any).minutes}
                  onChange={(e) =>
                    setTimeMode((prev: any) => ({
                      ...prev,
                      minutes: e.target.value,
                    }))
                  }
                />

                <button
                  className="text-xs border px-2 py-1 rounded"
                  onClick={() => {
                    const h = Number((timeMode as any).hours || 0);
                    const m = Number((timeMode as any).minutes || 0);

                    setTimeMode(h * 3600000 + m * 60000);
                  }}
                >
                  Apply
                </button>
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

        {(error as any) && (
          <div className="text-xs text-red-500">Failed to load news</div>
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
