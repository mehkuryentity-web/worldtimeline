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

// 1. Plain JavaScript Fetch for News (No TanStack Server Functions)
export const fetchLiveNews = async (data: { category: string }): Promise<{ items: ApiNewsItem[]; cached: boolean; error?: string }> => {
  try {
    const targetCategory = data.category === "all" ? "" : data.category;
    // Calling the API directly from the client side safely
    const url = `https://api.currentsapi.services/v1/latest-news?language=en${
      targetCategory ? `&category=${targetCategory}` : ""
    }`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Currents API error: ${response.statusText}`);
    }

    const result = await response.json();
    return { items: (result.news || []) as ApiNewsItem[], cached: false };
  } catch (e) {
    return { items: [], cached: false, error: e instanceof Error ? e.message : "Fetch failed" };
  }
};

// 2. Plain JavaScript Fetch for AI Briefing (No TanStack Server Functions)
export const generateBriefing = async (data: { headlines: string[] }): Promise<{ summary: string; error?: string }> => {
  if (data.headlines.length === 0) {
    return { summary: "No headlines available to summarize." };
  }

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
};
