import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, Radio } from "lucide-react";
import type { NewsItem } from "@/lib/mock-news";
import { TIMELINES, cacheArticles } from "@/lib/mock-news";
import { useAppState } from "@/hooks/use-app-state";
import { timeAgo } from "@/lib/format";
import { TimelineSheet } from "./TimelineSheet";
import { ReactionBar } from "./ReactionBar";
import { ArticleCover } from "./ArticleCover";

interface Props {
  item: NewsItem;
  /** When true, show recency based on ingestedAt (when we archived it)
   *  instead of publishedAt (the source's claimed publish time). Used by
   *  the home feed's time selector, whose 5m/10m/30m/1h/24h/custom windows
   *  now *filter* on ingestedAt too -- without this the card could pass a
   *  "last 10 min" filter yet display a stamp like "5h ago", which reads as
   *  broken even though the filter is working correctly. */
  useIngestedTime?: boolean;
}

export function NewsCard({ item, useIngestedTime = false }: Props) {
  const { award } = useAppState();
  const [openTimeline, setOpenTimeline] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const timeline = item.timelineId ? TIMELINES[item.timelineId] : null;
  const showImage = Boolean(item.image) && !imgFailed;
  const displayTimestamp = useIngestedTime ? item.ingestedAt ?? item.publishedAt : item.publishedAt;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface-1">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {item.category}
        </span>
        <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {timeAgo(displayTimestamp)}
        </span>
      </div>

      {showImage ? (
        <Link
          to="/article/$id"
          params={{ id: item.id }}
          onClick={() => { cacheArticles([item]); award("read_article"); }}
          className="block aspect-[16/9] w-full overflow-hidden bg-surface-2"
        >
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition hover:scale-[1.02]"
            onError={() => setImgFailed(true)}
          />
        </Link>
      ) : (
        // No source image (common for headline-list-only sources like
        // NewsNow) or the image URL 404'd -- a deterministic, category-
        // themed cover reads as intentional editorial artwork; an empty
        // gap where an image should be reads as broken.
        <Link
          to="/article/$id"
          params={{ id: item.id }}
          onClick={() => { cacheArticles([item]); award("read_article"); }}
          className="block aspect-[16/9] w-full overflow-hidden bg-surface-2"
        >
          <ArticleCover title={item.title} category={item.category} className="h-full w-full" />
        </Link>
      )}

      <Link
        to="/article/$id"
        params={{ id: item.id }}
        onClick={() => { cacheArticles([item]); award("read_article"); }}
        className="block px-4 py-3 transition hover:bg-background/30"
      >
        <h3 className="text-[16px] font-semibold leading-snug tracking-tight">{item.title}</h3>
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {item.summary}
        </p>
        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="text-foreground/80">{item.source}</span>
          <span>·</span>
          <span>{item.region}</span>
        </div>
      </Link>

      {timeline && (
        <div className="px-4 pb-3">
          <button
            onClick={() => setOpenTimeline(true)}
            className="mt-3 flex w-full items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 text-left transition hover:border-primary"
          >
            <span className="flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Timeline
              </span>
              <span className="text-xs text-foreground/90">{timeline.title}</span>
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {timeline.events.length} events →
            </span>
          </button>
        </div>
      )}

      <ReactionBar item={item} />

      {timeline && (
        <TimelineSheet open={openTimeline} onClose={() => setOpenTimeline(false)} timeline={timeline} />
      )}
    </article>
  );
}
