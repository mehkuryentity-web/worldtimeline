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
  // Use a fallback or public key configuration compatible with your build setup
  const apiKey = "missing_key";
  if (!apiKey || apiKey === "missing_key") {
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
            content: `You are a premier global intelligence editor synthesizing the absolute top stories for an elite, fast-paced news timeline app.
Analyze the provided list of top headlines and merge them into a single, masterful, unified macro-briefing.

CRITICAL CONTENT & COHESION RULES:
- DO NOT summarize the articles one by one. 
- Seamlessly blend the events together using smooth transitions (e.g., "While tech sectors brace for...", "Simultaneously, geopolitical shifts in...", "In tandem with these market movements...").
- Capture both the immediate events and their collective broader global impact, trends, or power shifts.

CRITICAL STRUCTURE RULES:
- STRICTLY FORBIDDEN: Bullet points, lists, bolding, titles, or headers of any kind.
- Write your entire response as EXACTLY ONE fluid, heavy-hitting paragraph.
- The total length must be substantial and dense, exactly 5 to 7 lines long total.
- Use a highly sophisticated, sharp, active, and authoritative editorial voice. Completely eliminate introductory filler.`,
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
