import { createServerFn } from "@tanstack/start";
import { z } from "zod";

interface ApiNewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  author: string;
  image: string;
  language: string;
  category: string[];
  published: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function fetchFromCurrents(category: string, apiKey: string): Promise<ApiNewsItem[]> {
  const targetCategory = category === "all" ? "" : category;
  const url = `https://api.currentsapi.services/v1/latest-news?apiKey=${apiKey}&language=en${
    targetCategory ? `&category=${targetCategory}` : ""
  }`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Currents API error: ${response.statusText}`);
  }

  const data = await response.json();
  return (data.news || []) as ApiNewsItem[];
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
      return { items: cached.payload as unknown as ApiNewsItem[], cached: true };
    }

    try {
      const items = await fetchFromCurrents(data.category, apiKey);
      await supabaseAdmin
        .from("news_cache")
        .insert({ category: data.category, payload: items as unknown as never });
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

      if (stale?.payload) return { items: stale.payload as unknown as ApiNewsItem[], cached: true };
      return { items: [], cached: false, error: e instanceof Error ? e.message : "Fetch failed" };
    }
  });

export const generateBriefing = createServerFn({ method: "POST" })
  .inputValidator((d: { headlines: string[] }) => z.object({ headlines: z.array(z.string()).max(10) }).parse(d))
  .handler(async ({ data }): Promise<{ summary: string; error?: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey || data.headlines.length === 0) {
      return { summary: data.headlines.slice(0, 4).join(" ") };
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
              content: "You are an executive intelligence editor. Summarize the top 4-5 news stories into exactly one smooth, high-density, authoritative narrative paragraph. Do not use bullet points, headers, or list formatting. Blend the stories together using fluid editorial transitions.",
            },
            {
              role: "user",
              content: data.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n"),
            },
          ],
        }),
      });

      if (!res.ok) {
        return { summary: data.headlines.slice(0, 4).join(" ") };
      }

      const json = await res.json();
      const summary = json.choices?.[0]?.message?.content?.trim() ?? "";
      return { summary: summary || data.headlines.slice(0, 4).join(" ") };
    } catch (e) {
      return {
        summary: data.headlines.slice(0, 4).join(" "),
        error: e instanceof Error ? e.message : "AI failed",
      };
    }
  });
