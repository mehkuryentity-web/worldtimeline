export interface ApiNewsItem {
  id: string;
  title: string;
  description?: string;
  summary?: string;
  url: string;
  author?: string;
  source?: string;
  image?: string;
  language?: string;
  category?: string | string[];
  published?: string;
  publishedAt?: string;
}

/* --------------------------------------- FETCH LIVE NEWS ----------------------------------------*/
export const fetchLiveNews = async (data: {
  category: string;
}): Promise<{ items: ApiNewsItem[]; cached: boolean; error?: string }> => {
  try {
    const targetCategory = data.category === "all" ? "" : data.category;
    const url = `https://api.currentsapi.services/v1/latest-news?language=en${
      targetCategory ? `&category=${targetCategory}` : ""
    }`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    const result = await response.json();
    return {
      items: (result.news || []) as ApiNewsItem[],
      cached: false,
    };
  } catch (e) {
    return {
      items: [],
      cached: false,
      error: e instanceof Error ? e.message : "Fetch failed",
    };
  }
};

/* --------------------------------------- SUPABASE KEY HELPER ----------------------------------------*/
function getSupabaseKey(): string {
  return (
    (import.meta.env && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    (window as any)._env_?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ""
  );
}

/* --------------------------------------- 
   SUPABASE AI BRIEFING (READ-ONLY FETCH)
   NOTE: This calls get-briefing, which only
   READS the latest cached row. The actual
   generation happens server-side via a
   Supabase Cron job calling generate-briefing
   every 12 minutes. The frontend never
   triggers generation, so there's never
   a wait for the user.
----------------------------------------*/
export const generateBriefing = async (): Promise<{
  summary: string;
  cached?: boolean;
  error?: string;
}> => {
  try {
    const SUPABASE_KEY = getSupabaseKey();
    // Correct URL pointing to get-briefing
    const res = await fetch("https://fadiusjtmtemxvysodie.supabase.co/functions/v1/get-briefing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      return { summary: "", error: `BRIEFING_FETCH_FAILED_${res.status}` };
    }

    const data = await res.json();
    // Corrected to look for 'summary' (the key your function returns)
    return {
      summary: data?.summary || "",
      cached: !!data?.cached,
    };
  } catch (e) {
    return {
      summary: "",
      error: e instanceof Error ? e.message : "UNKNOWN_ERROR",
    };
  }
};

/* --------------------------------------- PRELOADED SUMMARIES (EDGE FUNCTION) ----------------------------------------*/
export const fetchPreloadedSummaries = async (
  items: ApiNewsItem[]
): Promise<Record<string, string>> => {
  try {
    const url = "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/article-summary";
    const SUPABASE_KEY = getSupabaseKey();
    if (!SUPABASE_KEY) return {};

    const normalized = items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description || item.summary || "",
      url: item.url,
      author: item.source || item.author || "",
      image: item.image || "",
      language: item.language || "en",
      category: Array.isArray(item.category)
        ? item.category
        : item.category
        ? [item.category]
        : ["Top"],
      published: item.publishedAt || item.published || new Date().toISOString(),
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ articles: normalized }),
    });

    if (!response.ok) {
      return {};
    }
    const data = await response.json();
    return data?.summaries || {};
  } catch {
    return {};
  }
};
