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
   GEMINI BRIEFING (FINAL LOCKED VERSION)
----------------------------------------*/

export const generateBriefing = async (data: {
  headlines: string[];
  userName?: string | null;
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

    // STRICT identity rule: NEVER invent names
    const userName =
      typeof data.userName === "string" && data.userName.trim().length > 0
        ? data.userName.trim()
        : null;

    const promptText = `
You are a live newsroom editor writing a real-time news briefing.

OUTPUT STRUCTURE (MANDATORY):
1. Greeting line
2. ONE flowing newsroom paragraph
3. ONE short witty closing line

IDENTITY RULE:
- If a user name exists, use "Hi [Name],"
- If no user name exists, use "Hi,"

STYLE:
- Fast-paced newsroom wire tone (BBC / Reuters feel)
- Subtle dry wit allowed (restrained, not comedic)
- Clean transitions like "Meanwhile", "At the same time", "Elsewhere"
- Neutral, factual narration

STRICT RULES:
- One paragraph only for the main body
- No bullet points, no lists
- No moral commentary
- No emotional storytelling
- No summarizing each headline individually
- No invented identities or assumptions

WIT RULES:
- Closing line must be short, slightly sharp, editorial in tone
- No jokes, no slang, no exaggeration

INPUT HEADLINES:
${cleanHeadlines.join("\n")}
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

    let summary =
      json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!summary) throw new Error("Empty Gemini response");

    /* ---------------------------------------
       SAFETY ENFORCEMENT (FINAL GUARD RAILS)
    ----------------------------------------*/

    // Ensure greeting is correct and NEVER fake identity
    if (!summary.startsWith("Hi")) {
      summary = userName
        ? `Hi ${userName}, ${summary}`
        : `Hi, ${summary}`;
    }

    // Ensure closing line exists
    const lines = summary.split("\n").filter(Boolean);

    if (lines.length < 2) {
      summary += `\nToday continues, even when reporting pauses.`;
    }

    return { summary };
  } catch (e) {
    console.error("Briefing generation failed:", e);

    return {
      summary:
        data.userName
          ? `Hi ${data.userName}, live briefing is temporarily unavailable.\nToday continues, even when systems pause.`
          : `Hi, live briefing is temporarily unavailable.\nToday continues, even when systems pause.`,
      error: e instanceof Error ? e.message : "UNKNOWN_ERROR",
    };
  }
};
