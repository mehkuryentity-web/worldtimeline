import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface ApiNewsItem {
  id: string;
  category: string;
  title: string;
  source: string;
  region: string;
  publishedAt: string;
  summary: string;
  url: string;
  image?: string;
  breaking?: boolean;
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
};

const CACHE_TTL_MS = 60_000;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

async function fetchFromCurrents(category: string, apiKey: string): Promise<ApiNewsItem[]> {
  const mapped = CATEGORY_MAP[category];
  const url = new URL("https://api.currentsapi.services/v1/latest-news");
  url.searchParams.set("language", "en");
  if (mapped) url.searchParams.set("category", mapped);
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`CurrentsAPI ${res.status}`);
  }
  const json = (await res.json()) as {
    status?: string;
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
  const news = json.news ?? [];
  return news
    .filter((n) => n.title && n.url)
    .slice(0, 30)
    .map((n, i) => ({
      id: n.id ?? `${category}-${i}-${n.url}`,
      category,
      title: n.title,
      source: n.author && n.author !== "None" ? n.author : hostOf(n.url),
      region: (n.category && n.category[0]) || "Global",
      publishedAt: n.published ? new Date(n.published.replace(" +0000", "Z")).toISOString() : new Date().toISOString(),
      summary: n.description ?? "",
      url: n.url,
      image: n.image && n.image !== "None" ? n.image : undefined,
    }));
}

export const fetchLiveNews = createServerFn({ method: "GET" })
  .inputValidator((d: { category: string }) => z.object({ category: z.string() }).parse(d))
  .handler(async ({ data }): Promise<{ items: ApiNewsItem[]; cached: boolean; error?: string }> => {
    const apiKey = process.env.CURRENTS_API_KEY;
    if (!apiKey) return { items: [], cached: false, error: "Missing CURRENTS_API_KEY" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Try cache
    const since = new Date(Date.now() - CACHE_TTL_MS).toISOString();
    const { data: cached } = await supabaseAdmin
      .from("news_cache")
      .select("payload, fetched_at")
      .eq("category", data.category)
      .gte("fetched_at", since)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached?.payload) {
      return { items: cached.payload as ApiNewsItem[], cached: true };
    }

    try {
      const items = await fetchFromCurrents(data.category, apiKey);
      await supabaseAdmin.from("news_cache").insert({ category: data.category, payload: items });
      return { items, cached: false };
    } catch (e) {
      // Fall back to most recent cache, even if stale
      const { data: stale } = await supabaseAdmin
        .from("news_cache")
        .select("payload")
        .eq("category", data.category)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (stale?.payload) return { items: stale.payload as ApiNewsItem[], cached: true };
      return { items: [], cached: false, error: e instanceof Error ? e.message : "Fetch failed" };
    }
  });

export const generateBriefing = createServerFn({ method: "POST" })
  .inputValidator((d: { headlines: string[] }) => z.object({ headlines: z.array(z.string()).max(10) }).parse(d))
  .handler(async ({ data }): Promise<{ summary: string; error?: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey || data.headlines.length === 0) {
      return { summary: data.headlines.slice(0, 4).map((h) => `• ${h}`).join("\n") };
    }
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are WorldTimeline's editor. Write a 3-4 sentence global briefing connecting the headlines. Terse, neutral wire-style. No bullets, no headings, no preamble.",
            },
            {
              role: "user",
              content: data.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n"),
            },
          ],
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        return { summary: data.headlines.slice(0, 4).map((h) => `• ${h}`).join("\n"), error: `AI ${res.status}: ${t.slice(0, 120)}` };
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const summary = json.choices?.[0]?.message?.content?.trim() ?? "";
      return { summary: summary || data.headlines.slice(0, 4).map((h) => `• ${h}`).join("\n") };
    } catch (e) {
      return {
        summary: data.headlines.slice(0, 4).map((h) => `• ${h}`).join("\n"),
        error: e instanceof Error ? e.message : "AI failed",
      };
    }
  });
