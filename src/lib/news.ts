import type { Category, NewsItem } from "@/lib/mock-news";

const GET_NEWS_URL = "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/get-news";
const TRENDING_KEYWORDS_URL = "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/get-trending-keywords";

/**
 * ---- MULTI-PROVIDER NEWS ----
 * Replaces the old single-provider /api/news (Vercel, CurrentsAPI only,
 * called live on every page load with no caching). This calls the
 * Supabase-side get-news edge function instead, which reads from
 * news_archive -- already merged, deduped, and categorized server-side
 * across 5 providers (FreeNewsAPI, CurrentsAPI, World News API,
 * NewsData.io, SerpApi) by their own scheduled sync functions. Adding a
 * 6th provider later needs no frontend changes, same sources[] pattern
 * already used for Jobs and Videos.
 */
export async function getNews(category: Category, country: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(GET_NEWS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, country }),
    });

    if (!res.ok) return [];

    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];

    return items.map((n: any, i: number): NewsItem => ({
      id: n.id || n.url || String(i),
      category: (n.category as Category) || "Top",
      title: n.title,
      source: n.author || "News",
      region: n.region || "GLOBAL",
      publishedAt: n.publishedAt,
      summary: n.summary || "",
      url: n.url,
      image: n.image || undefined,
    }));
  } catch (e) {
    console.warn("News fetch crashed:", e);
    return [];
  }
}

/**
 * ---- ARCHIVE SEARCH ----
 * Backs the Trending page's search box and "trending searches" chips.
 * Calls the same get-news edge function with a `q` param, which runs an
 * ILIKE match against title + summary across the merged archive (7-day
 * window) and returns real matching articles. Replaces the old /api/news
 * Vercel route, which never read the search query at all.
 */
export async function searchNews(q: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(GET_NEWS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q }),
    });

    if (!res.ok) return [];

    const json = await res.json();
    const items = Array.isArray(json?.items) ? json.items : [];

    return items.map((n: any, i: number): NewsItem => ({
      id: n.id || n.url || String(i),
      category: (n.category as Category) || "Top",
      title: n.title,
      source: n.author || "News",
      region: n.region || "GLOBAL",
      publishedAt: n.publishedAt,
      summary: n.summary || "",
      url: n.url,
      image: n.image || undefined,
    }));
  } catch (e) {
    console.warn("News search crashed:", e);
    return [];
  }
}

/**
 * ---- TRENDING KEYWORDS ----
 * Real "trending searches" chips, computed server-side by the
 * get-trending-keywords edge function from recurring proper-noun phrases
 * in recent archive headlines (must appear in 2+ separate articles).
 * Cached 20 min on the server; callers should still keep a static
 * fallback list for the rare empty-result case (archive freshly emptied,
 * cold start, etc).
 */
export async function getTrendingKeywords(): Promise<string[]> {
  try {
    const res = await fetch(TRENDING_KEYWORDS_URL);
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.keywords) ? json.keywords : [];
  } catch (e) {
    console.warn("Trending keywords fetch crashed:", e);
    return [];
  }
}
