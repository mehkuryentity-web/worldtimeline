import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Share2,
  Bookmark,
  ExternalLink,
  CornerDownRight,
} from "lucide-react";
import type { NewsItem } from "@/lib/mock-news";
import { useAppState } from "@/hooks/use-app-state";
import { timeAgo } from "@/lib/format";
import {
  getCurrentUserId,
  getComments,
  addComment,
  getCommentCount,
  type NewsComment,
} from "@/lib/news-engagement";

interface Props {
  item: NewsItem;
  /** show the "Read at source" link (defaults false on detail page) */
  showReadLink?: boolean;
  /** start with the comments panel open */
  defaultCommentsOpen?: boolean;
}

export function ReactionBar({ item, showReadLink = true, defaultCommentsOpen = false }: Props) {
  const navigate = useNavigate();
  const { state, award, update } = useAppState();
  const rawArticle = state.articles[item.id];
  // Guard against a partial/legacy entry -- see original note: without
  // this, a stale local record with no fields throws and crashes the page.
  const a = {
    reaction: rawArticle?.reaction ?? null,
  };
  const isSaved = Boolean(state.saved?.[item.id]);

  const [openComments, setOpenComments] = useState(defaultCommentsOpen);
  const [commentText, setCommentText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const userChecked = useRef(false);

  useEffect(() => {
    if (userChecked.current) return;
    userChecked.current = true;
    getCurrentUserId().then(setUserId);
    getCommentCount(item.id).then(setCommentCount);
    // Runs once per card mount, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const requireAuth = () => {
    navigate({ to: "/auth" });
  };

  const loadComments = async () => {
    setLoadingComments(true);
    const data = await getComments(item.id);
    setComments(data);
    setLoadingComments(false);
  };

  const toggleComments = () => {
    const next = !openComments;
    setOpenComments(next);
    if (next && comments.length === 0) loadComments();
  };

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
      articles: { ...s.articles, [item.id]: { ...(s.articles[item.id] ?? {}), reaction: wasSame ? null : r } },
    }));
    if (!wasSame) award(r);
  };

  const submitComment = async () => {
    if (!userId) return requireAuth();
    const text = commentText.trim();
    if (!text) return;
    await addComment(item.id, userId, text, replyTo);
    award("comment");
    setCommentText("");
    setReplyTo(null);
    setCommentCount((n) => n + 1);
    loadComments();
  };

  const share = async () => {
    award("share");
    const shareUrl = `${window.location.origin}/article/${encodeURIComponent(item.id)}`;
    const data = { title: item.title, text: item.summary, url: shareUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(`${item.title} — ${shareUrl}`);
    } catch {
      /* user cancelled */
    }
  };

  const topLevelComments = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

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
            onClick={toggleComments}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Comments"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {commentCount > 0 && (
              <span className="font-mono tabular-nums">{commentCount}</span>
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
          {replyTo && (
            <button
              onClick={() => setReplyTo(null)}
              className="mb-2 font-mono text-[9px] uppercase tracking-wider text-primary"
            >
              Replying ×
            </button>
          )}
          <div className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder={userId ? "Add a comment…" : "Sign in to comment"}
              disabled={!userId}
              className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={submitComment}
              className="rounded-md bg-primary px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-primary-foreground disabled:opacity-50"
            >
              Post
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {loadingComments ? (
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Loading comments...
              </p>
            ) : topLevelComments.length === 0 ? (
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Be the first to comment · +5 pts
              </p>
            ) : (
              topLevelComments.map((c) => (
                <div key={c.id} className="space-y-1.5">
                  <div className="rounded-md bg-surface-2 px-3 py-2">
                    <p className="text-sm">{c.content}</p>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>{timeAgo(c.createdAt)}</span>
                      <button onClick={() => setReplyTo(c.id)} className="hover:text-primary">
                        Reply
                      </button>
                    </div>
                  </div>
                  {repliesOf(c.id).map((r) => (
                    <div key={r.id} className="ml-4 flex items-start gap-1.5">
                      <CornerDownRight className="mt-2 h-3 w-3 shrink-0 text-muted-foreground" />
                      <div className="flex-1 rounded-md bg-surface-2 px-3 py-2">
                        <p className="text-sm">{r.content}</p>
                        <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {timeAgo(r.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
