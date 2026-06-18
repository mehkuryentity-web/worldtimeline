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
   FETCH LIVE NEWS (UNCHANGED CORE)
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
   GEMINI BRIEFING (FINAL NEWSROOM + WIT)
----------------------------------------*/

export const generateBriefing = async (data: {
  headlines: string[];
}): Promise<{ summary: string; error?: string }> => {
  if (!data?.headlines?.length) {
    return { summary: "Waiting for live newsroom signals..." };
  }

  const GEMINI_API_KEY =
    (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || "";

  if (!GEMINI_API_KEY) {
    return { summary: "Briefing system misconfigured.", error: "NO_KEY" };
  }

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const cleanHeadlines = data.headlines
      .slice(0, 5)
      .map((h) => h?.trim())
      .filter(Boolean);

    if (!cleanHeadlines.length) {
      return { summary: "No live signals available." };
    }

    /* ---------------------------------------
       FINAL CONTROLLED NEWSROOM PROMPT
    ----------------------------------------*/

    const promptText = `
You are a live newsroom editor writing a real-time briefing.

CORE OUTPUT RULE:
Write ONE flowing paragraph only.

STYLE:
- Fast-paced newsroom wire style (BBC / Reuters feel)
- Subtle, restrained wit allowed (dry newsroom irony)
- Light observational tone, not comedic
- Occasional transitions like "Meanwhile", "At the same time", "Elsewhere"
- Natural flow, not list-based

STRICT RULES:
- No bullet points or headers
- No moral commentary or philosophical reflection
- No “spectrum of human experience” framing
- No quizzes, entertainment filler unless major headline
- Do NOT summarize each headline individually
- Do NOT repeat sentence structures
- Avoid exaggerated emotional language

WIT RULES:
- Wit must be subtle and dry (like a tired newsroom editor)
- No jokes, no sarcasm bursts, no comedy tone
- Light irony is allowed only when it feels natural

INPUT HEADLINES:
${cleanHeadlines.join("\n")}

OUTPUT:
One coherent newsroom paragraph only.
`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: promptText }],
          },
        ],
      }),
    });

    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);

    const json = await res.json();

    const summary =
      json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!summary) throw new Error("Empty Gemini response");

    return { summary };
  } catch (e) {
    console.error("Briefing generation failed:", e);

    return {
      summary:
        "Live briefing temporarily unavailable while signals stabilize.",
      error: e instanceof Error ? e.message : "UNKNOWN_ERROR",
    };
  }
};

/* ---------------------------------------
   PRELOADED SUMMARIES (UNCHANGED)
----------------------------------------*/

export const fetchPreloadedSummaries = async (
  items: ApiNewsItem[]
): Promise<Record<string, string>> => {
  if (!items?.length) return {};

  try {
    const url =
      "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/article-summary";

    const SUPABASE_KEY =
      (import.meta.env && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
      (window as any)._env_?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      "";

    if (!SUPABASE_KEY) {
      console.error("Missing Supabase key.");
      return {};
    }

    const normalizedItems = items.map((item) => ({
      id: item.id,
      title: item.title || "Untitled",
      description:
        item.summary || item.description || "No description available.",
      url: item.url || "https://worldtimeline.co",
      author: item.source || item.author || "Global Feed",
      image: item.image || "",
      language: item.language || "en",
      category: Array.isArray(item.category)
        ? item.category
        : [item.category || "Top"],
      published:
        item.publishedAt || item.published || new Date().toISOString(),
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ articles: normalizedItems }),
    });

    if (!response.ok) return {};

    const data = await response.json();

    return data.summaries || {};
  } catch (e) {
    console.error("Preload summaries failed:", e);
    return {};
  }
};
