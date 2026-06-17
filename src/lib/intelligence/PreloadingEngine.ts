import { mergeSummaryCache, loadSummaryCache } from "./aiCache";
import { fetchPreloadedSummaries } from "@/lib/news.functions";

let running = false;
let queue: any[] = [];

export function enqueueArticles(items: any[]) {
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
        title: item.title,
        description: item.summary || "",
        url: item.url || "",
        author: item.source || "",
        image: item.image || "",
        language: "en",
        category: [item.category],
        published: item.publishedAt,
      }));

      const result = await fetchPreloadedSummaries(formatted);

      if (result) {
        mergeSummaryCache(result);
      }

      // soft delay so you don’t overload edge function
      await new Promise((r) => setTimeout(r, 300));
    }
  } finally {
    running = false;
  }
}
