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
    if (!response.ok) throw new Error(`API error: ${response.statusText}`);

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
   GEMINI BRIEFING
----------------------------------------*/

export const generateBriefing = async (): Promise<{ summary: string; error?: string }> => {
  try {
    const res = await fetch(
      "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/generate-briefing",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    if (!res.ok) {
      return {
        summary: "",
        error: "BRIEFING_FETCH_FAILED",
      };
    }

    const data = await res.json();

    return {
      summary: data?.summary || "",
    };
  } catch (e) {
    return {
      summary: "",
      error: e instanceof Error ? e.message : "UNKNOWN_ERROR",
    };
  }
};

  const GEMINI_API_KEY =
    (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || "";

  if (!GEMINI_API_KEY) {
    return { summary: "Briefing system misconfigured.", error: "NO_KEY" };
  }

  const cleanHeadlines = data.headlines
    .slice(0, 5)
    .map((h) => h?.trim())
    .filter(Boolean);

  const userName =
    typeof data.userName === "string" && data.userName.trim().length > 0
      ? data.userName.trim()
      : null;

  const promptText = `
You are a live newsroom editor.

OUTPUT:
- Greeting
- ONE flowing paragraph
- ONE witty closing line

RULES:
- No bullet points
- No lists
- No moral commentary
- No fake identities
- Newsroom tone with subtle wit

Greeting rule:
- If name exists: "Hi [Name],"
- Else: "Hi,"

HEADLINES:
${cleanHeadlines.join("\n")}
`;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
    }),
  });

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);

  const json = await res.json();

  let summary =
    json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

  if (!summary) {
    return { summary: "Briefing failed to generate." };
  }

  if (!summary.startsWith("Hi")) {
    summary = userName
      ? `Hi ${userName}, ${summary}`
      : `Hi, ${summary}`;
  }

  if (!summary.includes("\n")) {
    summary += `\nToday continues beyond the headlines.`;
  }

  return { summary };
};

/* ---------------------------------------
   PRELOADED SUMMARIES (SINGLE SOURCE)
----------------------------------------*/

export const fetchPreloadedSummaries = async (
  items: ApiNewsItem[]
): Promise<Record<string, string>> => {
  try {
    const url =
      "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/article-summary";

    const SUPABASE_KEY =
      (import.meta.env && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
      (window as any)._env_?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      "";

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
      published:
        item.publishedAt || item.published || new Date().toISOString(),
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ articles: normalized }),
    });

    if (!response.ok) return {};

    const data = await response.json();

    return data?.summaries || {};
  } catch {
    return {};
  }
};
