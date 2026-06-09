import { createFileRoute } from "@tanstack/react-router";
import { Zap, Trophy, Wallet, Activity, Calendar, Trash2 } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useAppState } from "@/hooks/use-app-state";
import { getCycle, pointsToUSD, POINTS } from "@/lib/rewards";
import { timeAgo, timeLeft } from "@/lib/format";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile · WorldTimeline" },
      { name: "description", content: "Your reading activity, rewards, and 2-week payout cycle." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { state, update } = useAppState();
  const cycle = typeof window !== "undefined" ? getCycle() : { start: new Date().toISOString(), end: new Date().toISOString() };

  const totalActions = state.history.length;
  const totalComments = Object.values(state.articles).reduce((n, a) => n + a.comments.length, 0);
  const totalReactions = Object.values(state.articles).filter((a) => a.reaction).length;

  const resetAll = () => {
    if (!confirm("Reset all local activity and points?")) return;
    update(() => ({
      points: 0,
      totalEarned: 0,
      actionsByDay: {},
      articles: {},
      submissions: [],
      history: [],
    }));
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />
      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        {/* Identity */}
        <section className="flex items-center gap-3 rounded-xl border border-border bg-surface-1 p-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 font-mono text-sm text-primary">
            YOU
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Anonymous Reader</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Sign in to sync · enable Cloud
            </div>
          </div>
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary">
            Tier 1
          </span>
        </section>

        {/* Reward wallet */}
        <section className="overflow-hidden rounded-xl border border-border bg-surface-1">
          <div className="border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Wallet className="h-3.5 w-3.5 text-accent" />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                Reward Wallet
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Cycle points
              </div>
              <div className="mt-1 font-mono text-3xl tabular-nums">{state.points}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                ≈ <span className="text-foreground/90">${pointsToUSD(state.points).toFixed(2)}</span>
              </div>
            </div>
            <div className="p-4">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Lifetime earned
              </div>
              <div className="mt-1 font-mono text-3xl tabular-nums">{state.totalEarned}</div>
              <div className="mt-1 text-xs text-muted-foreground">across all cycles</div>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Next payout in
              </span>
              <span className="font-mono text-xs text-primary">{timeLeft(cycle.end)}</span>
            </div>
            <button className="rounded-md bg-primary px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary-foreground opacity-60">
              Locked
            </button>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-2">
          <Stat icon={Activity} label="Actions" value={totalActions} />
          <Stat icon={Trophy} label="Reactions" value={totalReactions} />
          <Stat icon={Zap} label="Comments" value={totalComments} />
        </section>

        {/* Earning guide */}
        <section className="rounded-xl border border-border bg-surface-1 p-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Earn points
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <Row label="Submit breaking news" pts={POINTS.submit_breaking} />
            <Row label="Comment on a story" pts={POINTS.comment} />
            <Row label="Share a story" pts={POINTS.share} />
            <Row label="Read the AI briefing" pts={POINTS.read_summary} />
            <Row label="Read an article" pts={POINTS.read_article} />
            <Row label="React (like / dislike)" pts={POINTS.like} />
          </ul>
        </section>

        {/* Recent activity */}
        <section className="rounded-xl border border-border bg-surface-1">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Recent activity
            </span>
            <button
              onClick={resetAll}
              className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Reset
            </button>
          </div>
          <div className="divide-y divide-border">
            {state.history.length === 0 ? (
              <p className="px-4 py-6 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
                No activity yet — start reading
              </p>
            ) : (
              state.history.slice(0, 10).map((h) => (
                <div key={h.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="text-sm">{labelFor(h.action)}</div>
                  <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>{timeAgo(h.at)} ago</span>
                    <span className="text-accent">+{h.points}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-3">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <div className="mt-1 font-mono text-xl tabular-nums">{value}</div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Row({ label, pts }: { label: string; pts: number }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-foreground/90">{label}</span>
      <span className="font-mono text-xs text-accent">+{pts}</span>
    </li>
  );
}

function labelFor(a: string): string {
  switch (a) {
    case "open_app": return "Opened the app";
    case "read_article": return "Read an article";
    case "read_summary": return "Read AI briefing";
    case "like": return "Liked a story";
    case "dislike": return "Disliked a story";
    case "comment": return "Posted a comment";
    case "share": return "Shared a story";
    case "submit_breaking": return "Submitted breaking news";
    default: return a;
  }
}
