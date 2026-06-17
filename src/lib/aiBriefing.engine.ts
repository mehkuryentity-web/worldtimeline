import { fetchPreloadedSummaries } from "@/lib/news.functions";
import { getAIIdentity } from "@/lib/aiIdentity";

const CACHE_KEY = "wt:ai-home-briefing:v1";

function loadCache(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

function saveCache(text: string) {
  try {
    localStorage.setItem(CACHE_KEY, text);
  } catch {}
}

export async function warmAIHomeBriefing(headlines: string[]) {
  // already exists → nothing to do
  const existing = loadCache();
  if (existing) return existing;

  const identity = getAIIdentity();

  try {
    const res = await fetchPreloadedSummaries(
      headlines.slice(0, 5).map((h, i) => ({
        id: `brief-${i}`,
        title: h,
        description: h,
        url: "",
        author: "system",
        image: "",
        language: "en",
        category: ["Top"],
        published: new Date().toISOString(),
      }))
    );

    const text = Object.values(res || {})
      .flat()
      .join(" ")
      .trim();

    const final =
      text.length > 0
        ? `Hi ${identity}. ${text}`
        : `Hi ${identity}. Today’s world feed is active across politics, markets, climate, and technology. Key updates are unfolding in real time.`;

    saveCache(final);
    return final;
  } catch {
    const fallback = `Hi ${identity}. Global news activity is currently stable and updating continuously.`;
    saveCache(fallback);
    return fallback;
  }
}
