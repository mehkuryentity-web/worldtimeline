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
  if (data.headlines.length === 0) {
    return { summary: "No headlines available to summarize." };
  }

  try {
    // Using an open access endpoint to ensure your prompt processes flawlessly on the frontend
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a premier global intelligence editor. Analyze the provided headlines and merge them into a single, masterful, unified macro-briefing paragraph. DO NOT summarize them one by one. Use sophisticated, sharp editorial transitions (e.g., 'While UK leadership intensifies geopolitical pressure, simultaneous structural shifts...'). Strictly forbidden: bullet points, lists, headers, or bold keys. Write exactly one dense, authoritative paragraph.",
          },
          {
            role: "user",
            content: data.headlines.slice(0, 5).join("\n"),
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
      error: e instanceof Error ? e.message : "AI processing failed",
    };
  }
};
