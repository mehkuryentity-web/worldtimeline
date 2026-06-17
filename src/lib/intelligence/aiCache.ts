const SUMMARY_CACHE_KEY = "wt:ai-summary:v2";

export type SummaryMap = Record<string, string[]>;

export function loadSummaryCache(): SummaryMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SUMMARY_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSummaryCache(map: SummaryMap) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify(map));
  } catch {}
}

export function mergeSummaryCache(newData: SummaryMap) {
  const existing = loadSummaryCache();
  const merged = { ...existing, ...newData };
  saveSummaryCache(merged);
  return merged;
}
