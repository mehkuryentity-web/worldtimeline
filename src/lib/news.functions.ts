interface ApiNewsItem {
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

export const fetchLiveNews = async (data: { category: string }): Promise<{ items: ApiNewsItem[]; cached: boolean; error?: string }> => {
  try {
    const targetCategory = data.category === "all" ? "" : data.category;
    const url = `https://api.currentsapi.services/v1/latest-news?language=en${
      targetCategory ? `&category=${targetCategory}` : ""
    }`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`API error: ${response.statusText}`);

    const result = await response.json();
    return { items: (result.news || []) as ApiNewsItem[], cached: false };
  } catch (e) {
    return { items: [], cached: false, error: e instanceof Error ? e.message : "Fetch failed" };
  }
};

export const generateBriefing = async (data: { headlines: string[] }): Promise<{ summary: string; error?: string }> => {
  if (!data || !data.headlines || data.headlines.length === 0) {
    return { summary: "Synthesizing live breaking news channels..." };
  }

  // Securely reads the key you just added to your Vercel Dashboard
  const GEMINI_API_KEY = (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || "";

  if (!GEMINI_API_KEY) {
    console.error("VITE_GEMINI_API_KEY is missing from the environment configuration.");
    return { summary: "Briefing system configuration error." };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const cleanHeadlines = data.headlines.slice(0, 5).map(h => h?.trim()).filter(Boolean);

    if (cleanHeadlines.length === 0) {
      return { summary: "Aggregating regional news fields..." };
    }

    const promptText = `You are an elite intelligence editor. Review these headlines and synthesize them into exactly ONE cohesive, fluid narrative paragraph. Your output must be concise and comfortably fit within about 6 to 7 lines of text on a mobile screen (around 90-110 words total). Do not summarize the headlines one by one. Blend them together seamlessly using sharp, professional transitions. Strictly forbidden: bullet points, lists, headers, or bold text formatting. Write exactly one authoritative, beautifully paced paragraph:\n\n${cleanHeadlines.join("\n")}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      }),
    });

    if (!res.ok) throw new Error(`Gemini API returned status ${res.status}`);

    const json = await res.json();
    const summary = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    
    if (!summary) throw new Error("Empty text block from Gemini");
    return { summary };
  } catch (e) {
    console.error("Briefing generation failed:", e);
    return {
      summary: "Gathering and synthesizing the latest updates...",
      error: e instanceof Error ? e.message : "Gemini failed",
    };
  }
};

export const fetchPreloadedSummaries = async (items: ApiNewsItem[]): Promise<Record<string, string>> => {
  return {};
};
