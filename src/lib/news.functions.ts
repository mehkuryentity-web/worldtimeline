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

export const fetchLiveNews = async (data: { category: string }): Promise<{ items: ApiNewsItem[]; cached: boolean; error?: string }> => {
  // Configured to dynamically resolve client-side or fallback seamlessly
  const apiKey = typeof process !== "undefined" ? process.env.CURRENTS_API_KEY : null;
  if (!apiKey) {
    return { items: [], cached: false, error: "Missing news API key configuration" };
  }

  try {
    const items = await fetchFromCurrents(data.category, apiKey);
    return { items, cached: false };
  } catch (e) {
    return { items: [], cached: false, error: e instanceof Error ? e.message : "Fetch failed" };
  }
};

export const generateBriefing = async (data: { headlines: string[] }): Promise<{ summary: string; error?: string }> => {
  if (data.headlines.length === 0) {
    return { summary: "No headlines available to summarize." };
  }

  const apiKey = typeof process !== "undefined" ? process.env.LOVABLE_API_KEY : null;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an executive intelligence editor. Summarize the top news stories into exactly one smooth, high-density, authoritative narrative paragraph. Do not use bullet points, headers, bold keys, or list formatting. Blend the stories together using fluid editorial transitions.",
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
