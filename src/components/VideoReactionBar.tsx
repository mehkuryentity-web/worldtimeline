import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageCircle, Share2, Bookmark, ExternalLink } from "lucide-react";
import type { VideoListing } from "@/lib/videos";
import { useAppState } from "@/hooks/use-app-state";
import { timeAgo } from "@/lib/format";

interface Props {
  video: VideoListing;
}

// Prefixed so a video's engagement never collides with an article of the
// same underlying id string in the shared state.articles / state.saved maps.
function engagementKey(videoId: string) {
  return `yt_${videoId}`;
}

export function VideoReactionBar({ video }: Props) {
  const { state, award, update } = useAppState();
  const key = engagementKey(video.id);
  const a = state.articles[key] ?? { reaction: null, comments: [] };
  const isSaved = Boolean(state.saved?.[key]);
  const [openComments, setOpenComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const watchUrl = `https://www.youtube.com/watch?v=${video.id}`;

  const toggleSave = () => {
    update((s) => {
      const next = { ...(s.saved ?? {}) };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = {
          id: key,
          title: video.title,
          summary: video.description,
          url: watchUrl,
          source: video.channelTitle,
          region: "YouTube",
          category: "Video",
          publishedAt: video.publishedAt,
          image: video.thumbnailUrl ?? undefined,
          savedAt: new Date().toISOString(),
        };
      }
      return { ...s, saved: next };
    });
  };

  const react = (r: "like" | "dislike") => {
    const wasSame = a.reaction === r;
    update((s) => ({
      ...s,
      articles: { ...s.articles, [key]: { ...a, reaction: wasSame ? null : r } },
    }));
    if (!wasSame) award(r);
  };

  const submitComment = () => {
    if (!commentText.trim()) return;
    update((s) => ({
      ...s,
      articles: {
        ...s.articles,
        [key]: {
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
    const data = { title: video.title, text: video.channelTitle, url: watchUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(`${video.title} — ${watchUrl}`);
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
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mr-1 flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
        >
          YouTube
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
    </>
  );
}
