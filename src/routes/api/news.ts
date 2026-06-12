import { createFileRoute } from "@tanstack/react-router";
import NodeCache from "node-cache";

// ─────────────────────────────────────────────────────────────────────────────
//  /api/news  — secure proxy to the news aggregator (CurrentsAPI)
//
//  Architecture (mirrors a typical Express controller):
//    1. The frontend NEVER calls the news API directly.
//    2. The API key is read from process.env.NEWS_API_KEY (server-only).
//    3. node-cache holds responses in memory with a 5-minute TTL.
//    4. On every request we check the cache first; on miss we hit the
//       upstream API and store the result. The key includes category +
//       country so each combination has its own cache slot.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes
// checkperiod:0 — Cloudflare Workers disallow setInterval at module scope.
// Lazy-init so the cache is created on first request, not at module load.
let _cache: NodeCache | null = null;
function getCache(): NodeCache {
  if (!_cache) _cache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, checkperiod: 0 });
  return _cache;
}

interface NewsItem {
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
  items: NewsItem[];
  cached: boolean;
  fetchedAt: string;
  country: string;
  category: string;
  error?: string;
}

const CATEGORY_MAP: Record<string, string | null> = {
  Top: null,
  World: "world",
  Politics: "politics",
  Business: "business",
  Tech: "technology",
  Science: "science",
  Sports: "sports",
  Climate: "environment",
  Health: "health",
  Entertainment: "entertainment",
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

async function fetchFromUpstream(
  category: string,
  country: string,
  apiKey: string,
  q?: string,
): Promise<NewsItem[]> {
  const mapped = CATEGORY_MAP[category] ?? null;
  // Use the /search endpoint when the user supplied keywords, otherwise the
  // standard latest-news endpoint. Both share the same response shape.
  const url = new URL(
    q
      ? "https://api.currentsapi.services/v1/search"
      : "https://api.currentsapi.services/v1/latest-news",
  );
  url.searchParams.set("language", "en");
  if (q) url.searchParams.set("keywords", q);
  if (mapped) url.searchParams.set("category", mapped);
  if (country && country !== "GLOBAL") {
    url.searchParams.set("country", country.toLowerCase());
  }
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Upstream news API ${res.status}`);
  }
  const json = (await res.json()) as {
    news?: Array<{
      id?: string;
      title: string;
      description?: string;
      url: string;
      image?: string;
      published?: string;
      author?: string;
      category?: string[];
    }>;
  };

  return (json.news ?? [])
    .filter((n) => n.title && n.url)
    .slice(0, 30)
    .map((n, i) => ({
      id: n.id ?? `${category}-${country}-${i}-${n.url}`,
      category,
      title: n.title,
      source: n.author && n.author !== "None" ? n.author : hostOf(n.url),
      region: (n.category && n.category[0]) || country || "Global",
      publishedAt: n.published
        ? new Date(n.published.replace(" +0000", "Z")).toISOString()
        : new Date().toISOString(),
      summary: n.description ?? "",
      url: n.url,
      image: n.image && n.image !== "None" ? n.image : undefined,
    }))
    // Newest first — feed refreshes show recency.
    .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

export const Route = createFileRoute("/api/news")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const category = (url.searchParams.get("category") || "Top").trim();
        const country = (url.searchParams.get("country") || "GLOBAL").trim().toUpperCase();
        const q = (url.searchParams.get("q") || "").trim();

        if (!Object.prototype.hasOwnProperty.call(CATEGORY_MAP, category)) {
          return json({ error: `Unknown category: ${category}` }, 400);
        }

        const apiKey = process.env.NEWS_API_KEY ?? process.env.CURRENTS_API_KEY;
        if (!apiKey) {
          return json(
            { error: "Server missing NEWS_API_KEY", items: [], cached: false },
            500,
          );
        }

        // Cache key includes the keyword bucket so searches are cached
        // independently. Repeated identical searches within 5 min are served
        // from memory; new keywords fall through and refresh.
        const cacheKey = `news:${country}:${category}:${q.toLowerCase()}`;
        const cache = getCache();
        const hit = cache.get<NewsResponse>(cacheKey);
        if (hit) {
          return json({ ...hit, cached: true } satisfies NewsResponse);
        }

        try {
          const items = await fetchFromUpstream(category, country, apiKey, q || undefined);
          const payload: NewsResponse = {
            items,
            cached: false,
            fetchedAt: new Date().toISOString(),
            country,
            category,
          };
          cache.set(cacheKey, payload);
          return json(payload);
        } catch (e) {
          return json(
            {
              items: [],
              cached: false,
              fetchedAt: new Date().toISOString(),
              country,
              category,
              error: e instanceof Error ? e.message : "Upstream fetch failed",
            } satisfies NewsResponse,
            502,
          );
        }
      },
    },
  },
});
