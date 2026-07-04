import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  MapPin,
  ExternalLink,
  Flame,
  MessageCircle,
  Share2,
  Bookmark,
  Flag,
  Eye,
  Send,
  CornerDownRight,
  Users,
} from "lucide-react";
import type { JobListing } from "@/lib/jobs";
import { timeAgo } from "@/lib/jobs";
import type { EngagementCounts, JobComment } from "@/lib/job-engagement";
import {
  getComments,
  addComment,
  recordView,
  reportJob,
  toggleInterested,
} from "@/lib/job-engagement";

interface JobCardProps {
  job: JobListing;
  userId: string | null;
  counts: EngagementCounts;
  interested: boolean;
  isSaved: boolean;
  onCountsChange: (jobId: string, updater: (c: EngagementCounts) => EngagementCounts) => void;
  onInterestedChange: (jobId: string, interested: boolean) => void;
  onToggleSave: (job: JobListing) => void;
}

const EMPTY_COUNTS: EngagementCounts = { interestedCount: 0, viewCount: 0, commentCount: 0 };

export function JobCard({
  job,
  userId,
  counts,
  interested,
  isSaved,
  onCountsChange,
  onInterestedChange,
  onToggleSave,
}: JobCardProps) {
  const navigate = useNavigate();
  const c = counts ?? EMPTY_COUNTS;

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<JobComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const [reported, setReported] = useState(false);
  const viewRecorded = useRef(false);

  useEffect(() => {
    if (!userId || viewRecorded.current) return;
    viewRecorded.current = true;
    recordView(job.id, userId).then(() => {
      onCountsChange(job.id, (prev) => ({
        ...prev,
        viewCount: prev.viewCount + 1,
      }));
    });
    // Intentionally runs once per card mount, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, job.id]);

  const requireAuth = () => {
    navigate({ to: "/auth" });
  };

  const handleInterested = () => {
    if (!userId) return requireAuth();
    const next = !interested;
    onInterestedChange(job.id, next);
    onCountsChange(job.id, (prev) => ({
      ...prev,
      interestedCount: prev.interestedCount + (next ? 1 : -1),
    }));
    toggleInterested(job.id, userId, interested);
  };

  const loadComments = async () => {
    setLoadingComments(true);
    const data = await getComments(job.id);
    setComments(data);
    setLoadingComments(false);
  };

  const toggleComments = () => {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && comments.length === 0) loadComments();
  };

  const submitComment = async () => {
    if (!userId) return requireAuth();
    const text = draft.trim();
    if (!text) return;
    await addComment(job.id, userId, text, replyTo);
    setDraft("");
    setReplyTo(null);
    onCountsChange(job.id, (prev) => ({
      ...prev,
      commentCount: prev.commentCount + 1,
    }));
    loadComments();
  };

  const handleShare = async () => {
    const shareData = {
      title: job.title,
      text: `${job.title} at ${job.company}`,
      url: job.applyUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(job.applyUrl);
        setShared(true);
        setTimeout(() => setShared(false), 1500);
      }
    } catch {
      // user cancelled the native share sheet -- not an error
    }
  };

  const handleReport = async () => {
    if (!userId) return requireAuth();
    if (reported) return;
    setReported(true);
    await reportJob(job.id, userId, "flagged_by_user");
  };

  const topLevelComments = comments.filter((cm) => !cm.parentId);
  const repliesOf = (id: string) => comments.filter((cm) => cm.parentId === id);

  return (
    <article className="rounded-md border border-border bg-surface-1 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {job.logoUrl ? (
            <img
              src={job.logoUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-md border border-border object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold">{job.title}</h3>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              {job.company}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {job.type}
          </span>
          {job.source === "community" && (
            <span className="flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">
              <Users className="h-2.5 w-2.5" /> Community
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" /> {job.location}
        <span className="ml-auto flex items-center gap-2 font-mono text-[10px]">
          <span className="flex items-center gap-0.5">
            <Eye className="h-3 w-3" /> {c.viewCount}
          </span>
          {timeAgo(job.postedAt)}
        </span>
      </div>

      {job.description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{job.description}</p>
      )}

      <a
        href={job.applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-primary py-2 font-mono text-[11px] uppercase tracking-wider text-primary-foreground"
      >
        Apply <ExternalLink className="h-3 w-3" />
      </a>

      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        <button
          onClick={handleInterested}
          className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
            interested ? "text-accent" : "text-muted-foreground hover:text-accent"
          }`}
        >
          <Flame className={`h-3.5 w-3.5 ${interested ? "fill-accent" : ""}`} />
          {c.interestedCount > 0 ? c.interestedCount : "Interested"}
        </button>

        <button
          onClick={toggleComments}
          className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {c.commentCount > 0 ? c.commentCount : "Comment"}
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <Share2 className="h-3.5 w-3.5" />
          {shared ? "Copied" : "Share"}
        </button>

        <button
          onClick={() => onToggleSave(job)}
          className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
            isSaved ? "text-primary" : "text-muted-foreground hover:text-primary"
          }`}
        >
          <Bookmark className={`h-3.5 w-3.5 ${isSaved ? "fill-primary" : ""}`} />
        </button>

        <button
          onClick={handleReport}
          disabled={reported}
          className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive disabled:opacity-50"
          aria-label="Report listing"
        >
          <Flag className="h-3.5 w-3.5" />
        </button>
      </div>

      {commentsOpen && (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {loadingComments ? (
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Loading comments...
            </p>
          ) : topLevelComments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No comments yet. Start the thread.</p>
          ) : (
            topLevelComments.map((cm) => (
              <div key={cm.id} className="space-y-1.5">
                <div className="rounded-md bg-surface-2 px-2.5 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <p>{cm.content}</p>
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    <span>{timeAgo(cm.createdAt)}</span>
                    <button
                      onClick={() => setReplyTo(cm.id)}
                      className="hover:text-primary"
                    >
                      Reply
                    </button>
                  </div>
                </div>
                {repliesOf(cm.id).map((r) => (
                  <div key={r.id} className="ml-4 flex items-start gap-1.5">
                    <CornerDownRight className="mt-2 h-3 w-3 shrink-0 text-muted-foreground" />
                    <div className="flex-1 rounded-md bg-surface-2 px-2.5 py-2 text-xs">
                      <p>{r.content}</p>
                      <span className="mt-1 block font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                        {timeAgo(r.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}

          <div className="flex items-center gap-1.5 pt-1">
            {replyTo && (
              <button
                onClick={() => setReplyTo(null)}
                className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-primary"
              >
                Replying ×
              </button>
            )}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder={userId ? "Add a comment..." : "Sign in to comment"}
              disabled={!userId}
              className="flex-1 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={submitComment}
              disabled={!draft.trim()}
              className="rounded-md bg-primary p-1.5 text-primary-foreground disabled:opacity-50"
              aria-label="Post comment"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
