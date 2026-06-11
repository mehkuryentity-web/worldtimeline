import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, ExternalLink, Trash2, ArrowLeft } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useAppState } from "@/hooks/use-app-state";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved · WorldTimeline" },
      { name: "description", content: "Your bookmarked headlines." },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const { state, update } = useAppState();
  const items = Object.values(state.saved ?? {}).sort((a, b) =>
    b.savedAt.localeCompare(a.savedAt),
  );

  const remove = (id: string) =>
    update((s) => {
      const next = { ...(s.saved ?? {}) };
      delete next[id];
      return { ...s, saved: next };
    });

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />
      <main className="mx-auto max-w-md space-y-3 px-4 pt-4">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>
          <h1 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
            <Bookmark className="h-3.5 w-3.5 text-primary" />
            Saved · {items.length}
          </h1>
          <span className="w-10" />
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-1 p-8 text-center">
            <Bookmark className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              No bookmarks yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tap the bookmark icon on any story to save it.
            </p>
          </div>
        ) : (
          items.map((it) => (
            <article
              key={it.id}
              className="overflow-hidden rounded-xl border border-border bg-surface-1"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{it.category} · {it.source}</span>
                <span>saved {timeAgo(it.savedAt)}</span>
              </div>
              <div className="px-4 py-3">
                <h3 className="text-[15px] font-semibold leading-snug">{it.title}</h3>
                {it.summary && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                    {it.summary}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
                <button
                  onClick={() => remove(it.id)}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
                <a
                  href={it.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
                >
                  Read <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </article>
          ))
        )}
      </main>
      <BottomNav />
    </div>
  );
}
