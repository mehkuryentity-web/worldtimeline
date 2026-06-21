import { fetchNewsMemory } from "@/lib/news-memory";
import { fetchLiveNews } from "@/lib/news-live";

export interface UnifiedNewsItem {
  id: string;
  title: string;
  publishedAt: string;
  source?: string;
  category?: string;
}

/**
 * SIMPLE IN-MEMORY CACHE (per session)
 * prevents re-fetch flicker
 */
let cache: {
  headlines: string[];
  timestamp: number;
} | null = null;

const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

function normalize(item: any): UnifiedNewsItem | null {
  if (!item) return null;

  return {
    id: item.id ?? item.url ?? item.title,
    title: item.title,
    publishedAt:
      item.publishedAt ?? item.published_at ?? new Date().toISOString(),
    source: item.source,
    category: item.category,
  };
}

/**
 * HYBRID ENGINE (NO FAIL MODE)
 */
export async function getHybridHeadlines(
  category: string,
  country: string
): Promise<string[]> {
  const now = Date.now();

  /**
   * 1. RETURN CACHE INSTANTLY (NO LOADING STATE)
   */
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return cache.headlines;
  }

  /**
   * 2. MEMORY FETCH (FASTEST RELIABLE SOURCE)
   */
  let memory: any[] = [];
  try {
    memory = await fetchNewsMemory(50);
  } catch (e) {
    console.warn("Memory fetch failed:", e);
    memory = [];
  }

  /**
   * 3. START LIVE FETCH IN BACKGROUND (DO NOT BLOCK UI)
   */
  let live: any[] = [];
  fetchLiveNews(category, country)
    .then((res) => {
      live = res ?? [];
    })
    .catch((err) => {
      console.warn("Live news failed (ignored):", err);
      live = [];
    });

  /**
   * 4. BUILD BASE STREAM IMMEDIATELY (NO WAIT FOR LIVE)
   */
  const combined = [...(memory ?? [])];

  const map = new Map<string, UnifiedNewsItem>();

  for (const raw of combined) {
    const item = normalize(raw);
    if (!item || !item.title) continue;

    map.set(item.id, item);
  }

  const sorted = Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() -
      new Date(a.publishedAt).getTime()
  );

  const headlines = sorted.map((item) => item.title);

  /**
   * 5. UPDATE CACHE
   */
  cache = {
    headlines,
    timestamp: now,
  };

  /**
   * 6. RETURN INSTANT RESULT (NO LOADING DELAY)
   */
  return headlines;
}
