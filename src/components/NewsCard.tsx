import { useState } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Share2,
  Clock,
  ExternalLink,
  Radio,
} from "lucide-react";
import type { NewsItem } from "@/lib/mock-news";
import { TIMELINES } from "@/lib/mock-news";
import { useAppState } from "@/hooks/use-app-state";
import { timeAgo } from "@/lib/format";
import { TimelineSheet } from "./TimelineSheet";

interface Props {
  item: NewsItem;
}

export function NewsCard({ item }: Props) {
  const { state, award, update } = useAppState();
  const a = state.articles[item.id] ?? { reaction: null, comments: [] };
  const [openComments, setOpenComments] = useState(false);
  const [openTimeline, setOpenTimeline] = useState(false);
  const [commentText, setCommentText] = useState("");

  const react = (r: "like" | "dislike") => {
    const wasSame = a.reaction === r;
    update((s) => ({
      ...s,
      articles: {
        ...s.articles,
        [item.id]: { ...a, reaction: wasSame ? null : r },
      },
    }));
    if (!wasSame) award(r);
  };

  const submitComment = () => {
    if (!commentText.trim()) return;
    update((s) => ({
      ...s,
      articles: {
        ...s.articles,
        [item.id]: {
          ...a,
          comments: [
            { id: crypto.randomUUID(), at: new Date().toISOString(), text: commentText.trim() },
            ...a.comments,
          ],
        },
      },
    }));
    award("comment");
    setCommentText("");
  };

  const share = async () => {
    award("share");
    const data = { title: item.title, text: item.summary, url: item.url };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(`${item.title} — ${item.url}`);
    } catch {
      /* user cancelled */
    }
  };

  const timeline = item.timelineId ? TIMELINES[item.timelineId] : null;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface-1">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          {item.breaking && (
            <span className="rounded-sm bg-breaking px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
              Breaking
            </span>
          )}
          {item.live && (
            <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-live">
              <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live" />
              Live
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

      <div className="px-4 py-3">
        <h3 className="text-[16px] font-semibold leading-snug tracking-tight">{item.title}</h3>
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {item.summary}
        </p>
        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="text-foreground/80">{item.source}</span>
          <span>·</span>
          <span>{item.region}</span>
        </div>

        {timeline && (
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
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
        <div className="flex items-center">
          <button
            onClick={() => react("like")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
              a.reaction === "like" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => react("dislike")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
              a.reaction === "dislike" ? "text-destructive" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setOpenComments((v) => !v)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {a.comments.length > 0 && <span className="font-mono tabular-nums">{a.comments.length}</span>}
          </button>
          <button
            onClick={share}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <a
          href={item.url}
          className="mr-1 flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
          onClick={() => award("read_article")}
        >
          Read
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {openComments && (
        <div className="border-t border-border bg-background/30 px-3 py-3">
          <div className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="Add a comment…"
              className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              onClick={submitComment}
              className="rounded-md bg-primary px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-primary-foreground"
            >
              Post
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {a.comments.length === 0 ? (
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Be the first to comment · +5 pts
              </p>
            ) : (
              a.comments.map((c) => (
                <div key={c.id} className="rounded-md bg-surface-2 px-3 py-2">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span className="text-primary">you</span>
                    <span>· {timeAgo(c.at)}</span>
                  </div>
                  <p className="mt-1 text-sm">{c.text}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {timeline && (
        <TimelineSheet open={openTimeline} onClose={() => setOpenTimeline(false)} timeline={timeline} />
      )}
    </article>
  );
}
