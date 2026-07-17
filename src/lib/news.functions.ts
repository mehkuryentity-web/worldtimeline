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

/* ---------------------------------------
   FETCH LIVE NEWS
----------------------------------------*/

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

/* ---------------------------------------
   SUPABASE KEY HELPER
----------------------------------------*/

function getSupabaseKey(): string {
  return (
    (import.meta.env && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    (window as any)._env_?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ""
  );
}

/* ---------------------------------------
   SUPABASE AI BRIEFING
   Sends the currently selected country/category/mode
   plus the already-filtered headlines from the homepage.
   The backend decides whether to serve cache or generate.
----------------------------------------*/

export interface BriefingParams {
  country: string;
  category: string;
  mode: string;
  headlines: string[];
}

export const generateBriefing = async (
  params: BriefingParams
): Promise<{
  summary: string;
  conclusion?: string;
  cached?: boolean;
  error?: string;
}> => {
  try {
    const SUPABASE_KEY = getSupabaseKey();

    const res = await fetch(
      "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/get-briefing",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify(params),
      }
    );

    if (!res.ok) {
      return {
        summary: "",
        error: `BRIEFING_FETCH_FAILED_${res.status}`,
      };
    }

    const data = await res.json();

    return {
      summary: data?.summary || "",
      conclusion: data?.conclusion || "",
      cached: !!data?.cached,
    };
  } catch (e) {
    return {
      summary: "",
      error: e instanceof Error ? e.message : "UNKNOWN_ERROR",
    };
  }
};


