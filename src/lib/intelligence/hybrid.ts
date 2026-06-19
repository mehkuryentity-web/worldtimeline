import { fetchNewsMemory } from "@/lib/news-memory";
import { fetchLiveNews } from "@/lib/news-live";

export interface UnifiedNewsItem {
  id: string;
  title: string;
  publishedAt: string;
  source?: string;
  category?: string;
}

/**
 * HYBRID ENGINE (SINGLE SOURCE OF TRUTH)
 *
 * Responsibilities:
 * - Merge Supabase memory + live API
 * - Deduplicate intelligently
 * - Sort by recency
 * - Output clean AI-ready headlines
 */

function normalize(item: any): UnifiedNewsItem | null {
  if (!item) return null;

  return {
    id: item.id ?? item.url ?? item.title,
    title: item.title,
    publishedAt: item.publishedAt ?? item.published_at ?? new Date().toISOString(),
    source: item.source,
    category: item.category,
  };
}

export async function getHybridHeadlines(
  category: string,
  country: string
): Promise<string[]> {
  // 1. Pull memory (Supabase)
  const memory = await fetchNewsMemory(50);

  // 2. Pull live (API)
  const live = await fetchLiveNews(category, country);

  // 3. Merge into one stream
  const combined = [...memory, ...live];

  // 4. Deduplicate using stable map
  const map = new Map<string, UnifiedNewsItem>();

  for (const raw of combined) {
    const item = normalize(raw);
    if (!item || !item.title) continue;

    // Prefer most recent version if duplicates exist
    const existing = map.get(item.id);

    if (!existing) {
      map.set(item.id, item);
    } else {
      const existingTime = new Date(existing.publishedAt).getTime();
      const newTime = new Date(item.publishedAt).getTime();

      if (newTime > existingTime) {
        map.set(item.id, item);
      }
    }
  }

  // 5. Sort newest → oldest
  const sorted = Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() -
      new Date(a.publishedAt).getTime()
  );

  // 6. Return AI-ready headlines
  return sorted.map((item) => item.title);
}
