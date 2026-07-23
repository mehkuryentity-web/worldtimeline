import type { Category, NewsItem } from "@/lib/mock-news";

const GET_NEWS_URL = "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/get-news";
const TRENDING_KEYWORDS_URL = "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/get-trending-keywords";
const TRENDING_NEWS_URL = "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/get-trending-news";

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
 * ---- ARCHIVE SEARCH (general, non-Trending use) ----
 * Kept for any other caller that wants a plain recency-sorted archive
 * search. The Trending page itself now uses searchTrendingArticles below
 * instead, since plain search doesn't rank or dedupe by story.
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

function mapTrendingItems(json: any): NewsItem[] {
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
}

/**
 * ---- TRENDING ARTICLES ("Viral right now") ----
 * Replaces the old getNews("Top","GLOBAL") call, which made the default
 * Trending view an exact duplicate of the Global Top feed. This calls
 * get-trending-news instead, which scores stories by freshness (50%) +
 * source-diversity / "global importance" (31%) + mention-velocity as a
 * search-interest proxy (19%), and collapses multi-outlet coverage of the
 * same event into a single representative article per story -- fixing
 * both the "looks like Top" complaint and the repeated-articles bug.
 */
export async function getTrendingArticles(): Promise<NewsItem[]> {
  try {
    const res = await fetch(TRENDING_NEWS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return [];
    return mapTrendingItems(await res.json());
  } catch (e) {
    console.warn("Trending articles fetch crashed:", e);
    return [];
  }
}

/**
 * ---- TRENDING SEARCH (keyword chip or free text) ----
 * If `q` matches one of the currently-computed trending phrases (i.e. the
 * user clicked a chip from getTrendingKeywords), returns that story's full
 * deduped article list. Otherwise falls back to an archive-wide search
 * with light near-duplicate title collapsing, so even an arbitrary search
 * term doesn't get flooded by one heavily-covered event.
 */
export async function searchTrendingArticles(q: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(TRENDING_NEWS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q }),
    });
    if (!res.ok) return [];
    return mapTrendingItems(await res.json());
  } catch (e) {
    console.warn("Trending search crashed:", e);
    return [];
  }
}
