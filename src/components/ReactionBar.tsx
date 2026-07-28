import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageCircle, Share2, Bookmark, ExternalLink } from "lucide-react";
import type { NewsItem } from "@/lib/mock-news";
import { useAppState } from "@/hooks/use-app-state";
import { timeAgo } from "@/lib/format";

interface Props {
  item: NewsItem;
  /** show the "Read at source" link (defaults false on detail page) */
  showReadLink?: boolean;
  /** start with the comments panel open */
  defaultCommentsOpen?: boolean;
}

export function ReactionBar({ item, showReadLink = true, defaultCommentsOpen = false }: Props) {
  const { state, award, update } = useAppState();
  const rawArticle = state.articles[item.id];
  // Guard against a partial/legacy entry (e.g. `{ reaction: "like" }` with no
  // `comments` array) -- without this, spreading `a.comments` in
  // submitComment throws and crashes the whole page instead of just this
  // comment.
  const a = {
    reaction: rawArticle?.reaction ?? null,
    comments: Array.isArray(rawArticle?.comments) ? rawArticle.comments : [],
  };
  const isSaved = Boolean(state.saved?.[item.id]);
  const [openComments, setOpenComments] = useState(defaultCommentsOpen);
  const [commentText, setCommentText] = useState("");

  const toggleSave = () => {
    update((s) => {
      const next = { ...(s.saved ?? {}) };
      if (next[item.id]) delete next[item.id];
      else
        next[item.id] = {
          id: item.id,
          title: item.title,
          summary: item.summary,
          url: item.url,
          source: item.source,
          region: item.region,
          category: item.category,
          publishedAt: item.publishedAt,
          image: item.image,
          savedAt: new Date().toISOString(),
        };
      return { ...s, saved: next };
    });
  };

  const react = (r: "like" | "dislike") => {
    const wasSame = a.reaction === r;
    update((s) => ({
      ...s,
      articles: { ...s.articles, [item.id]: { ...a, reaction: wasSame ? null : r } },
    }));
    if (!wasSame) award(r);
  };

  const submitComment = () => {
    if (!commentText.trim()) return;
    try {
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
    } catch (err) {
      // Never let a comment-post failure crash the whole page to the
      // generic error boundary -- worst case, the comment silently
      // doesn't post and the input stays as-is so the user can retry.
      console.error("Failed to post comment", err);
    }
  };

  const share = async () => {
    award("share");
    const shareUrl = `${window.location.origin}/article/${item.id}`;
    const data = { title: item.title, text: item.summary, url: shareUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(`${item.title} — ${shareUrl}`);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <>
      <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
        <div className="flex items-center">
          <button
            onClick={() => react("like")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
              a.reaction === "like" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
            aria-label="Like"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => react("dislike")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
              a.reaction === "dislike" ? "text-destructive" : "text-muted-foreground hover:text-foreground"
            }`}
            aria-label="Dislike"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setOpenComments((v) => !v)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Comments"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {a.comments.length > 0 && (
              <span className="font-mono tabular-nums">{a.comments.length}</span>
            )}
          </button>
          <button
            onClick={share}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Share"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={toggleSave}
            aria-label={isSaved ? "Remove bookmark" : "Save for later"}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition ${
              isSaved ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${isSaved ? "fill-current" : ""}`} />
          </button>
        </div>
        {showReadLink && item.url && item.url !== "#" && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mr-1 flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
            onClick={() => award("read_article")}
          >
            Read
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
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
    </>
  );
}
