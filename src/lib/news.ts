import type { Category, NewsItem } from "@/lib/mock-news";

const GET_NEWS_URL = "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/get-news";

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
