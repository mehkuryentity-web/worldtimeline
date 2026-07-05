import { useEffect, useState } from "react";
import { Bell, Check, ExternalLink, Flame, Trash2, X } from "lucide-react";
import { timeAgo } from "@/lib/jobs";
import {
  getMatchHistory,
  markOneMatchSeen,
  markMatchesSeen,
  clearAllMatches,
} from "@/lib/job-matches";
import type { MatchNotification } from "@/lib/job-matches";

interface NotificationsPanelProps {
  userId: string;
  onClose: () => void;
  onAllSeen: () => void;
}

export function NotificationsPanel({ userId, onClose, onAllSeen }: NotificationsPanelProps) {
  const [matches, setMatches] = useState<MatchNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const data = await getMatchHistory(userId);
    setMatches(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const markAllRead = async () => {
    await markMatchesSeen(userId);
    setMatches((prev) => prev.map((m) => ({ ...m, seen: true })));
    onAllSeen();
  };

  const markOneRead = async (matchId: string) => {
    await markOneMatchSeen(matchId);
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, seen: true } : m)));
  };

  const clearAll = async () => {
    await clearAllMatches(userId);
    setMatches([]);
    onAllSeen();
  };

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Bell className="h-4 w-4 text-primary" /> Notifications
        </h2>
        <button onClick={onClose} aria-label="Close" className="text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {matches.length > 0 && (
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={markAllRead}
            className="font-mono text-[10px] uppercase tracking-wider text-primary"
          >
            Mark all read
          </button>
          <button
            onClick={clearAll}
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" /> Clear all
          </button>
        </div>
      )}

      <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto">
        {loading ? (
          <p className="py-6 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Loading...
          </p>
        ) : matches.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No matches yet. Set your interests and check back after the next sync.
          </p>
        ) : (
          matches.map((m) => (
            <div
              key={m.id}
              className={`rounded-md border p-2.5 ${
                m.seen ? "border-border bg-surface-1" : "border-primary bg-primary/5"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{m.jobTitle}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{m.jobCompany}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {m.score && (
                      <span
                        className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider ${
                          m.score === "strong"
                            ? "bg-accent/20 text-accent"
                            : "bg-surface-2 text-muted-foreground"
                        }`}
                      >
                        <Flame className="h-2.5 w-2.5" />
                        {m.score === "strong" ? "Strong match" : "Possible match"}
                      </span>
                    )}
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      via "{m.matchedKeyword}" · {m.matchedInterest} · {timeAgo(m.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {m.jobApplyUrl && (
                    <a
                      href={m.jobApplyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md bg-primary p-1.5 text-primary-foreground"
                      aria-label="Apply"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {!m.seen && (
                    <button
                      onClick={() => markOneRead(m.id)}
                      className="rounded-md bg-surface-2 p-1.5 text-muted-foreground hover:text-primary"
                      aria-label="Mark as read"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
