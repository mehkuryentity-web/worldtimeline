import type { NewsItem } from "@/lib/mock-news";

export type MicroLabel = "LIVE" | "JUST IN" | "HOT";

/**
 * Pick the single most relevant micro-label for an item.
 * Priority: LIVE > JUST IN > HOT.
 *  - LIVE: ongoing/streamable coverage flagged by source.
 *  - JUST IN: published within the last 30 minutes.
 *  - HOT: trending — currently mapped to the upstream "breaking" flag.
 */
export function microLabel(item: NewsItem): MicroLabel | null {
  if (item.live) return "LIVE";
  const ageMin = (Date.now() - +new Date(item.publishedAt)) / 60_000;
  if (Number.isFinite(ageMin) && ageMin <= 30) return "JUST IN";
  if (item.breaking) return "HOT";
  return null;
}

export function microLabelClass(label: MicroLabel): string {
  switch (label) {
    case "LIVE":
      return "bg-live/15 text-live";
    case "JUST IN":
      return "bg-primary/15 text-primary";
    case "HOT":
      return "bg-breaking/15 text-breaking";
  }
}
