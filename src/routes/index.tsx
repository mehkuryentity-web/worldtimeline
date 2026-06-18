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
} from "@/lib/mock-news";

import { findCountry } from "@/lib/countries";
import { useAppState } from "@/hooks/use-app-state";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

/* ---------------- TYPES ---------------- */

type Mode = "OFF" | "5M" | "30M" | "1H" | "CUSTOM";

/* ---------------- FETCH ---------------- */

async function fetchNews(category: Category, country: string) {
  const res = await fetch(
    `/api/news?category=${encodeURIComponent(category)}&country=${encodeURIComponent(country)}`
  );
  return res.json();
}

function normalizeCategory(cat: string): Category {
  const found = CATEGORIES.find(
    (c) => c.toLowerCase() === cat.toLowerCase()
  );
  return found ?? "Top";
}

/* ---------------- HOME ---------------- */

function Home() {
  const [category, setCategory] = useState<Category>("Top");

  const { state, update } = useAppState();

  const [country, setCountryState] = useState<string>(
    () => state.country ?? "GLOBAL"
  );

  /* ---------------- TIME CONTROL ---------------- */

  const [mode, setMode] = useState<Mode>("OFF");
  const [refreshMs, setRefreshMs] = useState<number>(0);

  const [customH, setCustomH] = useState(0);
  const [customM, setCustomM] = useState(0);

  const countryMeta = findCountry(country);

  const setCountry = (code: string) => {
    setCountryState(code);
    update((s) => ({ ...s, country: code }));
  };

  /* ---------------- APPLY MODE ---------------- */

  useEffect(() => {
    switch (mode) {
      case "OFF":
        setRefreshMs(0);
        break;
      case "5M":
        setRefreshMs(5 * 60 * 1000);
        break;
      case "30M":
        setRefreshMs(30 * 60 * 1000);
        break;
      case "1H":
        setRefreshMs(60 * 60 * 1000);
        break;
      case "CUSTOM":
        break;
    }
  }, [mode]);

  function applyCustom() {
    const ms = (customH * 60 + customM) * 60 * 1000;

    setRefreshMs(ms);
    setMode("CUSTOM");
  }

  /* ---------------- DATA ---------------- */

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

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />

      <Ticker items={items.slice(0, 8).map((i) => i.title)} />

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4 pb-6">
        <AISummaryCard headlines={items.slice(0, 6).map((i) => i.title)} />

        <CountrySelector value={country} onChange={setCountry} />

        {/* ---------------- TIME CONTROL (FIXED CLEAN UI) ---------------- */}

        <div className="border rounded p-3 space-y-3">

          {/* SEGMENTED CONTROL */}
          <div className="flex gap-2 text-xs flex-wrap">
            {[
              { key: "OFF", label: "OFF" },
              { key: "5M", label: "5m" },
              { key: "30M", label: "30m" },
              { key: "1H", label: "1h" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setMode(t.key as Mode)}
                className={`px-2 py-1 border rounded ${
                  mode === t.key ? "bg-black text-white" : ""
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* CUSTOM INPUT */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">custom</span>

            <input
              type="number"
              placeholder="hrs"
              value={customH}
              onChange={(e) => setCustomH(Number(e.target.value))}
              className="w-12 text-xs border rounded px-1"
            />

            <input
              type="number"
              placeholder="min"
              value={customM}
              onChange={(e) => setCustomM(Number(e.target.value))}
              className="w-12 text-xs border rounded px-1"
            />

            <button
              onClick={applyCustom}
              className="text-xs px-2 py-1 border rounded"
            >
              set
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
