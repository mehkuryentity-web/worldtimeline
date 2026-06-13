import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, Radio } from "lucide-react";
import type { NewsItem } from "@/lib/mock-news";
import { TIMELINES } from "@/lib/mock-news";
import { useAppState } from "@/hooks/use-app-state";
import { timeAgo } from "@/lib/format";
import { TimelineSheet } from "./TimelineSheet";
import { ReactionBar } from "./ReactionBar";

interface Props {
  item: NewsItem;
}

export function NewsCard({ item }: Props) {
  const { award } = useAppState();
  const [openTimeline, setOpenTimeline] = useState(false);
  const timeline = item.timelineId ? TIMELINES[item.timelineId] : null;
  const label = microLabel(item);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface-1">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          {label && (
            <span
              className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${microLabelClass(label)}`}
            >
              {label}
            </span>
          )}
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {item.category}
          </span>
        </div>
        <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {timeAgo(item.publishedAt)}
        </span>
      </div>

      {item.image && (
        <Link
          to="/article/$id"
          params={{ id: item.id }}
          onClick={() => award("read_article")}
          className="block aspect-[16/9] w-full overflow-hidden bg-surface-2"
        >
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition hover:scale-[1.02]"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </Link>
      )}

      <Link
        to="/article/$id"
        params={{ id: item.id }}
        onClick={() => award("read_article")}
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
