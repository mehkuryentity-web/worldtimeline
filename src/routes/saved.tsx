import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bookmark, ExternalLink, Trash2, ArrowLeft, GraduationCap, Coins, Briefcase, Newspaper,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useAppState } from "@/hooks/use-app-state";
import { timeAgo } from "@/lib/format";
import { getSaved as getXploreSaved, XPLORE_SAVED_KEY, type XploreItem, type PanelId } from "@/routes/xplore";
import type { SavedItem } from "@/lib/rewards";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved · WorldTimeline" },
      { name: "description", content: "Your bookmarked headlines, jobs, scholarships, grants and internships." },
    ],
  }),
  component: SavedPage,
});

type TabId = "all" | "news" | "jobs" | "scholarships" | "grants" | "internships";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "news", label: "News" },
  { id: "jobs", label: "Jobs" },
  { id: "scholarships", label: "Scholarships" },
  { id: "grants", label: "Grants" },
  { id: "internships", label: "Internships" },
];

const SECTION_ICON: Record<Exclude<PanelId, "jobs">, typeof GraduationCap> = {
  scholarships: GraduationCap,
  grants: Coins,
  internships: Briefcase,
};

function SavedPage() {
  const { state, update } = useAppState();
  const [xploreSaved, setXploreSaved] = useState<Record<string, XploreItem>>(() => getXploreSaved());
  const [tab, setTab] = useState<TabId>("all");

  // Xplore saves happen outside React state (plain localStorage), so refresh
  // on the events toggleSavedItem fires (same tab) and on "storage" (other
  // tabs), same pattern useAppState already uses for its own store.
  useEffect(() => {
    const sync = () => setXploreSaved(getXploreSaved());
    window.addEventListener("wt:xplore-saved", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("wt:xplore-saved", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const newsItems = useMemo(
    () =>
      Object.values(state.saved ?? {})
        .filter((it) => it.category !== "Jobs")
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    [state.saved],
  );
  const jobItems = useMemo(
    () =>
      Object.values(state.saved ?? {})
        .filter((it) => it.category === "Jobs")
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    [state.saved],
  );
  const xploreBySection = useMemo(() => {
    const buckets: Record<Exclude<PanelId, "jobs">, XploreItem[]> = {
      scholarships: [], grants: [], internships: [],
    };
    for (const it of Object.values(xploreSaved)) {
      if (it.savedSection && buckets[it.savedSection]) buckets[it.savedSection].push(it);
    }
    for (const key of Object.keys(buckets) as (keyof typeof buckets)[]) {
      buckets[key].sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
    }
    return buckets;
  }, [xploreSaved]);

  const counts: Record<TabId, number> = {
    all: newsItems.length + jobItems.length + xploreBySection.scholarships.length
      + xploreBySection.grants.length + xploreBySection.internships.length,
    news: newsItems.length,
    jobs: jobItems.length,
    scholarships: xploreBySection.scholarships.length,
    grants: xploreBySection.grants.length,
    internships: xploreBySection.internships.length,
  };

  const removeSaved = (id: string) =>
    update((s) => {
      const next = { ...(s.saved ?? {}) };
      delete next[id];
      return { ...s, saved: next };
    });

  const removeXplore = (id: string) => {
    const next = { ...xploreSaved };
    delete next[id];
    setXploreSaved(next);
    try {
      localStorage.setItem(XPLORE_SAVED_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("wt:xplore-saved"));
    } catch {
      // storage unavailable -- item still disappears from this session's view
    }
  };

  const showNews = tab === "all" || tab === "news";
  const showJobs = tab === "all" || tab === "jobs";
  const showScholarships = tab === "all" || tab === "scholarships";
  const showGrants = tab === "all" || tab === "grants";
  const showInternships = tab === "all" || tab === "internships";
  const nothingToShow = counts[tab] === 0;

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
            Saved · {counts.all}
          </h1>
          <span className="w-10" />
        </div>

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${
                tab === t.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {counts[t.id] > 0 && <span className="tabular-nums">{counts[t.id]}</span>}
            </button>
          ))}
        </div>

        {counts.all === 0 ? (
          <div className="rounded-xl border border-border bg-surface-1 p-8 text-center">
            <Bookmark className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              No bookmarks yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tap the bookmark icon on any story, job, scholarship, grant or internship to save it.
            </p>
          </div>
        ) : nothingToShow ? (
          <div className="rounded-xl border border-border bg-surface-1 p-8 text-center">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Nothing saved here yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {showNews && newsItems.map((it) => (
              <NewsSavedCard key={it.id} item={it} onRemove={() => removeSaved(it.id)} />
            ))}
            {showJobs && jobItems.map((it) => (
              <NewsSavedCard key={it.id} item={it} onRemove={() => removeSaved(it.id)} icon={Briefcase} />
            ))}
            {showScholarships && xploreBySection.scholarships.map((it) => (
              <XploreSavedCard key={it.id} item={it} onRemove={() => removeXplore(it.id)} />
            ))}
            {showGrants && xploreBySection.grants.map((it) => (
              <XploreSavedCard key={it.id} item={it} onRemove={() => removeXplore(it.id)} />
            ))}
            {showInternships && xploreBySection.internships.map((it) => (
              <XploreSavedCard key={it.id} item={it} onRemove={() => removeXplore(it.id)} />
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function NewsSavedCard({
  item, onRemove, icon: Icon = Newspaper,
}: {
  item: SavedItem;
  onRemove: () => void;
  icon?: typeof Newspaper;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface-1">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Icon className="h-3 w-3" />
          {item.category} · {item.source}
        </span>
        <span>saved {timeAgo(item.savedAt)}</span>
      </div>
      <div className="px-4 py-3">
        <h3 className="text-[15px] font-semibold leading-snug">{item.title}</h3>
        {item.summary && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
        <button
          onClick={onRemove}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" /> Remove
        </button>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
        >
          Read <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </article>
  );
}

function XploreSavedCard({ item, onRemove }: { item: XploreItem; onRemove: () => void }) {
  const Icon = (item.savedSection && SECTION_ICON[item.savedSection]) ?? Bookmark;
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface-1">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Icon className="h-3 w-3" />
          {item.savedSection ?? "saved"} · {item.source}
        </span>
        <span>{item.savedAt ? `saved ${timeAgo(item.savedAt)}` : ""}</span>
      </div>
      <div className="px-4 py-3">
        <h3 className="text-[15px] font-semibold leading-snug">{item.title}</h3>
        {item.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
        <button
          onClick={onRemove}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" /> Remove
        </button>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
          >
            View <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </article>
  );
}
