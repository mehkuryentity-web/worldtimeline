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

  const GEMINI_API_KEY = "AIzaSyDNgGHldmvi__dkox9sXOvnwuyi8AyJztU";

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    // Strictly slice the incoming list to only use the top 5 stories
    const topFiveHeadlines = data.headlines.slice(0, 5).join("\n");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an elite intelligence editor. Review these 5 headlines and synthesize them into exactly ONE cohesive, fluid narrative paragraph. Your output must be concise and comfortably fit within about 6 to 7 lines of text on a mobile screen (around 90-110 words total). Do not summarize the headlines one by one. Blend them together seamlessly using sharp, professional transitions. Strictly forbidden: bullet points, lists, headers, or bold text formatting. Write exactly one authoritative, beautifully paced paragraph:\n\n${topFiveHeadlines}`
          }]
        }]
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.statusText}`);
    }

    const json = await res.json();
    const summary = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    return { summary: summary || data.headlines.slice(0, 4).join(" ") };
  } catch (e) {
    return {
      summary: data.headlines.slice(0, 4).join(" "),
      error: e instanceof Error ? e.message : "Gemini failed",
    };
  }
};
