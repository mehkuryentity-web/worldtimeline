import { mergeSummaryCache } from "./aiCache";
import { fetchPreloadedSummaries } from "@/lib/news.functions";

type QueueItem = {
  id: string;
  title: string;
  summary?: string;
  url?: string;
  source?: string;
  image?: string;
  category?: string | string[];
  publishedAt?: string;
};

let running = false;
let queue: QueueItem[] = [];

export function enqueueArticles(items: QueueItem[]) {
  queue.push(...items);
  run();
}

async function run() {
  if (running) return;
  running = true;

  try {
    while (queue.length > 0) {
      const batch = queue.splice(0, 6);

      const formatted = batch.map((item) => ({
        id: item.id,
        title: item.title ?? "Untitled",
        description: item.summary ?? "",
        url: item.url ?? "",
        author: item.source ?? "",
        image: item.image ?? "",
        language: "en",
        category: Array.isArray(item.category)
          ? item.category
          : item.category
          ? [item.category]
          : ["Top"],
        published: item.publishedAt ?? new Date().toISOString(),
      }));

      const result = await fetchPreloadedSummaries(formatted);

      if (result && Object.keys(result).length > 0) {
        mergeSummaryCache(result);
      }

      await new Promise((r) => setTimeout(r, 300));
    }
  } finally {
    running = false;
  }
}
