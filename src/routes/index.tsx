import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { AISummaryCard } from "@/components/AISummaryCard";
import { CategoryTabs } from "@/components/CategoryTabs";
import { CountrySelector } from "@/components/CountrySelector";
import { NewsCard } from "@/components/NewsCard";
import { VideoCard } from "@/components/VideoCard";
import { Ticker } from "@/components/Ticker";
import { TelemetryPreloader } from "@/components/TelemetryPreloader";

import {
  type Category,
  CATEGORIES,
  type NewsItem,
  cacheArticles,
} from "@/lib/mock-news";

import { findCountry } from "@/lib/countries";
import { useAppState } from "@/hooks/use-app-state";
import { Loader2, Timer } from "lucide-react";

import { getNews } from "@/lib/news";
import { getVideos, formatViewCount, type VideoListing } from "@/lib/videos";

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

type Mode =
  | "all"
  | "5m"
  | "10m"
  | "30m"
  | "1h"
  | "24h"
  | "custom";

function Home() {
  const { state, award, update } = useAppState();

  const [category, setCategoryState] = useState<Category>(() => {
    // Guards against stale localStorage from before a category was ever
    // renamed/removed (e.g. the old "Video" -> "Videos" rename) -- an
    // unrecognized persisted value silently fell through as neither a
    // real category nor the video-only guard, leaking real articles into
    // what should have been a pure video feed. Any value not currently in
    // CATEGORIES falls back to "Top" instead of trusting it blindly.
    const stored = state.category as Category | undefined;
    return stored && CATEGORIES.includes(stored) ? stored : "Top";
  });

  const [country, setCountryState] = useState<string>(
    () => state.country ?? "GLOBAL"
  );

  const [mode, setModeState] = useState<Mode>(
    () => (state.feedMode as Mode) ?? "all"
  );

  const [customRange, setCustomRangeState] = useState({
    hours: state.customRangeHours ?? "",
    minutes: state.customRangeMinutes ?? "",
  });

  const touchStartX = useRef<number | null>(null);

  const touchStartY = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // Must be a clear intentional horizontal swipe:
    // - exceeds 80px horizontal travel (rules out taps entirely)
    // - horizontal movement at least 2x vertical (rules out diagonal scrolls)
    if (Math.abs(deltaX) < 80 || Math.abs(deltaX) < Math.abs(deltaY) * 2) return;
    // Don't swipe if the touch ended inside an anchor or button (tap on a card link)
    const target = e.target as HTMLElement;
    if (target.closest("a, button")) return;
    const currentIndex = CATEGORIES.indexOf(category);
    if (deltaX > 0) setCategory(CATEGORIES[Math.max(0, currentIndex - 1)]);
    else setCategory(CATEGORIES[Math.min(CATEGORIES.length - 1, currentIndex + 1)]);
  };
  const countryMeta = findCountry(country);

  const setCountry = (code: string) => {
    setCountryState(code);
    update((s) => ({ ...s, country: code }));
  };

  const setCategory = (c: Category) => {
    setCategoryState(c);
    update((s) => ({ ...s, category: c }));
  };

  const setMode = (m: Mode) => {
    setModeState(m);
    update((s) => ({ ...s, feedMode: m }));
  };

  const setCustomRange = (
    updater: (p: { hours: string; minutes: string }) => {
      hours: string;
      minutes: string;
    }
  ) => {
    setCustomRangeState((prev) => {
      const next = updater(prev);
      update((s) => ({
        ...s,
        customRangeHours: next.hours,
        customRangeMinutes: next.minutes,
      }));
      return next;
    });
  };

  useEffect(() => {
    award("open_app");
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["news", country, category],
    // "Videos" isn't a real news category -- that tab is video-only, so
    // there's no point spending an API call that would just come back empty.
    enabled: category !== "Videos",
    queryFn: async () => {
      const items = await getNews(category, country);
      return { items };
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // The telemetry preloader is reserved for the very first feed load only.
  // Category/country switches re-trigger isLoading (new query key), but
  // those should stay on the plain inline spinner, not the full animation.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  useEffect(() => {
    if (!isLoading && data) setHasLoadedOnce(true);
  }, [isLoading, data]);

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

  let windowMs = 0;

  switch (mode) {
    case "5m":
      windowMs = 5 * 60 * 1000;
      break;
    case "10m":
      windowMs = 10 * 60 * 1000;
      break;
    case "30m":
      windowMs = 30 * 60 * 1000;
      break;
    case "1h":
      windowMs = 60 * 60 * 1000;
      break;
    case "24h":
      windowMs = 24 * 60 * 60 * 1000;
      break;
    case "custom":
      windowMs =
        Number(customRange.hours || 0) * 3600000 +
        Number(customRange.minutes || 0) * 60000;
      break;
    case "all":
    default:
      windowMs = 0;
  }

  let items: NewsItem[] = [];

  if (mode === "all") {
    items = [...allItems].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() -
        new Date(a.publishedAt).getTime()
    );
  } else {
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

  // Summaries are generated purely on-click (see article.$id.tsx) and cached
  // server-side in ai_article_summaries, shared across every user -- no
  // preloading here, so we never spend Groq tokens on articles nobody
  // actually opens.
  useEffect(() => {
    if (!items.length) return;
    cacheArticles(items);
  }, [items]);

  // ---- VIDEO FEED (mixed into the main feed, not a separate tab) ----
  // Fetched independently of articles so a Supabase hiccup here never
  // blocks the article feed from rendering.
  const { data: videosData } = useQuery({
    queryKey: ["videos", country],
    queryFn: () => getVideos(country),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const videoItems: VideoListing[] = videosData?.videos ?? [];

  // Same time-window filter as articles, so switching "5 min / 24h / Custom"
  // applies consistently to both.
  const filteredVideos =
    mode === "all"
      ? videoItems
      : videoItems.filter((v) => {
          const age = now - new Date(v.publishedAt).getTime();
          return age <= windowMs;
        });

  type FeedEntry = { publishedAt: string; node: JSX.Element };

  // Fixed cadence instead of a pure chronological merge: YouTube's trending
  // videos are often days old even while currently trending, so sorting
  // purely by publishedAt sank every video to the bottom, under the freshest
  // articles. One video after every 3 articles, both lists pre-sorted by
  // recency within themselves.
  const ARTICLES_PER_VIDEO = 3;

  const sortedVideos = [...filteredVideos].sort((a, b) => {
    const ta = new Date(a.publishedAt).getTime();
    const tb = new Date(b.publishedAt).getTime();
    return mode === "all" ? tb - ta : ta - tb;
  });

  const feedEntries: FeedEntry[] = [];

  if (category === "Videos") {
    // Dedicated video-only tab: show every matched video (no articles to
    // interleave with anyway -- items is empty here by design).
    sortedVideos.forEach((v) => {
      feedEntries.push({
        publishedAt: v.publishedAt,
        node: <VideoCard key={`v-${v.id}`} video={v} />,
      });
    });
  } else {
    // Mixed feed: strict 1-video-per-3-articles cadence. Any videos beyond
    // what the current article count actually supports are held back
    // rather than dumped back-to-back at the end -- that pile-up was the
    // bug. They'll surface naturally as more articles load via Load More.
    let videoIdx = 0;

    items.forEach((item, i) => {
      feedEntries.push({
        publishedAt: item.publishedAt,
        node: <NewsCard key={`a-${item.id}`} item={item} />,
      });

      if ((i + 1) % ARTICLES_PER_VIDEO === 0 && videoIdx < sortedVideos.length) {
        const v = sortedVideos[videoIdx];
        feedEntries.push({
          publishedAt: v.publishedAt,
          node: <VideoCard key={`v-${v.id}`} video={v} />,
        });
        videoIdx++;
      }
    });
  }

  // ---- INFINITE SCROLL (persisted across back-navigation) ----
  // visibleCount is restored from persisted state on mount instead of
  // always starting at PAGE_SIZE -- otherwise, going back from an article
  // remounts Home with a freshly-short feed, and the correctly-restored
  // scroll *pixel offset* lands the user somewhere totally different from
  // where they actually were (this was the exact bug reported).
  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCountState] = useState<number>(
    () => state.feedVisibleCount ?? PAGE_SIZE
  );

  const setVisibleCount = (updater: (c: number) => number) => {
    setVisibleCountState((prev) => {
      const next = updater(prev);
      update((s) => ({ ...s, feedVisibleCount: next }));
      return next;
    });
  };

  // Only reset to PAGE_SIZE on a REAL filter change during this mount's
  // lifetime -- not on the initial mount itself, which would otherwise
  // immediately wipe out the just-restored persisted count above.
  const isFirstFilterRender = useRef(true);
  useEffect(() => {
    if (isFirstFilterRender.current) {
      isFirstFilterRender.current = false;
      return;
    }
    setVisibleCount(() => PAGE_SIZE);
  }, [country, category, mode]);

  const visibleEntries = feedEntries.slice(0, visibleCount);
  const hasMore = visibleCount < feedEntries.length;

  // Sentinel div near the bottom of the rendered list -- IntersectionObserver
  // reveals the next page automatically as it scrolls into view, instead of
  // requiring a tap.
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, feedEntries.length));
        }
      },
      { rootMargin: "600px" } // start loading before the user actually hits bottom
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, feedEntries.length]);


  // ---- SCROLL POSITION: save on scroll, restore on mount ----
  // We throttle saves to every ~200ms so we're not hammering localStorage
  // on every pixel of movement.
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => {
      if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
      scrollSaveTimer.current = setTimeout(() => {
        update((s) => ({ ...s, feedScrollY: window.scrollY }));
      }, 200);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
    };
  }, []);

  // Restore scroll position after the feed has painted.
  // We wait for visibleCount cards to actually be in the DOM before
  // jumping -- otherwise the page is too short and the restore silently
  // clamps to 0. A double-rAF gives the browser one full paint cycle.
  const scrollRestored = useRef(false);
  useEffect(() => {
    if (scrollRestored.current) return;
    const target = state.feedScrollY;
    if (!target || target < 10) return;
    scrollRestored.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: target, behavior: "instant" });
      });
    });
  }, [visibleEntries.length]);

  // Clear saved scroll when the user actively changes a filter
  // (they're starting a fresh browse, not returning from an article).
  const isFirstFilterChange = useRef(true);
  useEffect(() => {
    if (isFirstFilterChange.current) {
      isFirstFilterChange.current = false;
      return;
    }
    scrollRestored.current = false;
    update((s) => ({ ...s, feedScrollY: 0 }));
  }, [country, category, mode]);

  // ---- BRIEFING INPUT: category-aware ----
  // Videos tab has no articles to summarize (items is empty there by
  // design), so feed the briefing top 5 videos' title/channel/view-count
  // instead -- same pipeline, different "headlines" content. Everywhere
  // else, real category-filtered article titles as before.
  const briefingHeadlines: string[] =
    category === "Videos"
      ? sortedVideos.slice(0, 5).map((v) => {
          const views = formatViewCount(v.viewCount);
          return `${v.title} — ${v.channelTitle}${views ? ` (${views})` : ""}`;
        })
      : items.slice(0, 6).map((i) => i.title);

  const isCustomValid =
    customRange.hours.trim() !== "" ||
    customRange.minutes.trim() !== "";

  const showCustom = mode === "custom";

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />

      <Ticker items={items.slice(0, 8).map((i) => i.title)} />

      <main className="mx-auto max-w-md space-y-4 px-4 pt-4 pb-6">
        <AISummaryCard
          headlines={briefingHeadlines}
          country={country}
          category={category}
          mode={mode}
        />

        <div className="flex items-center justify-between gap-2">
          <CountrySelector value={country} onChange={setCountry} />

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Timer className="h-3 w-3" />

              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
                className="text-xs border rounded px-2 py-1"
              >
                <option value="all">All News</option>
                <option value="5m">5 min</option>
                <option value="10m">10 min</option>
                <option value="30m">30 min</option>
                <option value="1h">1 hour</option>
                <option value="24h">24 hours</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {showCustom && (
              <div className="flex gap-2 items-center">
                <input
                  className="border px-2 py-1 text-xs w-20"
                  placeholder="hrs"
                  value={customRange.hours}
                  onChange={(e) =>
                    setCustomRange((p) => ({
                      ...p,
                      hours: e.target.value,
                    }))
                  }
                />

                <input
                  className="border px-2 py-1 text-xs w-20"
                  placeholder="min"
                  value={customRange.minutes}
                  onChange={(e) =>
                    setCustomRange((p) => ({
                      ...p,
                      minutes: e.target.value,
                    }))
                  }
                />
              </div>
            )}
          </div>
        </div>


        <CategoryTabs value={category} onChange={setCategory} />

        <h2 className="text-[10px] uppercase text-muted-foreground">
          {countryMeta.flag} {countryMeta.name} · {category}
        </h2>

        {/* Touch handlers live on this stable wrapper, not on the branches
            below -- it must stay mounted through category/country switches
            so a swipe fired while the next category is still loading isn't
            dropped onto a handler-less spinner div. */}
        <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {isLoading ? (
            hasLoadedOnce ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading feed...
              </div>
            ) : (
              <TelemetryPreloader />
            )
          ) : (
            <div className="space-y-3">
              {visibleEntries.map((entry) => entry.node)}
            </div>
          )}
        </div>

        {hasMore && (
          <div ref={sentinelRef} className="h-8 w-full" aria-hidden="true" />
        )}
      </main>

      <BottomNav />
    </div>
  );
}
