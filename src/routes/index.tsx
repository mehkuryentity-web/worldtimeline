import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
} from "@/lib/mock-news";

import { findCountry } from "@/lib/countries";
import { useAppState } from "@/hooks/use-app-state";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

/* ---------------- TIME CONTROL ---------------- */

const SLIDER_VALUES = [
  0, // OFF
  5 * 60 * 1000,
  10 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
  24 * 60 * 60 * 1000,
];

function formatLabel(ms: number) {
  if (ms === 0) return "Off";
  if (ms < 60 * 60 * 1000) return `${ms / 60000} min`;
  return `${ms / 3600000} hr`;
}

function normalizeCategory(cat: string): Category {
  const found = CATEGORIES.find(
    (c) => c.toLowerCase() === cat.toLowerCase()
  );
  return found ?? "Top";
}

async function fetchNews(category: Category, country: string) {
  const res = await fetch(
    `/api/news?category=${encodeURIComponent(category)}&country=${encodeURIComponent(country)}`
  );
  return res.json();
}

/* ---------------- HOME ---------------- */

function Home() {
  const [category, setCategory] = useState<Category>("Top");
  const [country, setCountryState] = useState("GLOBAL");

  // main recency window (OFF default)
  const [refreshMs, setRefreshMs] = useState<number>(0);

  // custom input
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(0);

  const { state, update } = useAppState();
  const countryMeta = findCountry(country);

  const setCountry = (code: string) => {
    setCountryState(code);
    update((s) => ({ ...s, country: code }));
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["news", country, category],
    queryFn: () => fetchNews(category, country),
    refetchInterval: refreshMs > 0 ? refreshMs : false,
    staleTime: 0,
  });

  const apiItems: NewsItem[] = (data?.items ?? []).map((n: any) => ({
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

  const userItems: NewsItem[] = (state.userPosts ?? []).map((p: any) => ({
    id: p.id,
    category: normalizeCategory(p.category),
    title: p.title,
    source: "Community",
    region: p.region || "Community",
    publishedAt: p.publishedAt,
    summary: p.summary,
    url: "#",
    image: p.media?.find((m: any) => m.type === "image")?.dataUrl,
  }));

  const allItems = [...userItems, ...apiItems].sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)
  );

  const now = Date.now();

  const items =
    refreshMs > 0
      ? allItems.filter(
          (i) => now - +new Date(i.publishedAt) <= refreshMs
        )
      : allItems;

  /* ---------------- TIME LOGIC ---------------- */

  function setFromSlider(value: number) {
    setRefreshMs(value);
  }

  function applyCustomRange() {
    const ms = (customHours * 60 + customMinutes) * 60 * 1000;
    setRefreshMs(ms);
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />

      <Ticker items={items.slice(0, 8).map((i) => i.title)} />

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4 pb-6">
        <AISummaryCard headlines={items.slice(0, 6).map((i) => i.title)} />

        <CountrySelector value={country} onChange={setCountry} />

        {/* ---------------- TIME CONTROL BAR ---------------- */}
        <div className="flex flex-col gap-2 border rounded p-2">

          {/* SLIDER */}
          <input
            type="range"
            min={0}
            max={SLIDER_VALUES.length - 1}
            value={SLIDER_VALUES.indexOf(refreshMs)}
            onChange={(e) =>
              setFromSlider(SLIDER_VALUES[Number(e.target.value)])
            }
          />

          {/* LABEL */}
          <div className="text-xs text-muted-foreground">
            Recency: {formatLabel(refreshMs)}
          </div>

          {/* CUSTOM RANGE */}
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="hrs"
              className="w-12 text-xs border rounded px-1"
              value={customHours}
              onChange={(e) => setCustomHours(Number(e.target.value))}
            />

            <input
              type="number"
              placeholder="min"
              className="w-12 text-xs border rounded px-1"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(Number(e.target.value))}
            />

            <button
              onClick={applyCustomRange}
              className="text-xs px-2 py-1 border rounded"
            >
              Apply
            </button>
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

        {error && (
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
