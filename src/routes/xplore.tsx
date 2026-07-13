import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  GraduationCap,
  BookOpen,
  Coins,
  RefreshCw,
  AlertTriangle,
  Clock,
  Globe,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";

// ─── Types ────────────────────────────────────────────────────────────────────

interface XploreItem {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  source: string;
  deadline: string | null;
  rolling: boolean;
  fetched_at: string;
  // scholarships
  country?: string | null;
  field_of_study?: string | null;
  funding_type?: string | null;
  level?: string | null;
  // grants
  category?: string | null;
  amount?: number | null;
  currency?: string | null;
  // internships
  company?: string | null;
  remote?: boolean;
  duration?: string | null;
}

interface XploreResponse {
  ok: boolean;
  type: string;
  page: number;
  count: number;
  items: XploreItem[];
  sources: { source: string; label: string; lastFetchedAt: string; count: number }[];
}

type SectionId = "internships" | "scholarships" | "grants";

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://fadiusjtmtemxvysodie.supabase.co";

const SECTIONS = [
  { id: "internships" as SectionId, label: "Internships", icon: GraduationCap, emoji: "🎓" },
  { id: "scholarships" as SectionId, label: "Scholarships", icon: BookOpen, emoji: "📚" },
  { id: "grants" as SectionId, label: "Grants", icon: Coins, emoji: "💰" },
] as const;

const SAVED_KEY = "xplore_saved";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSaved(): Record<string, XploreItem> {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setSaved(data: Record<string, XploreItem>) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(data));
  } catch {}
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function formatDeadline(deadline: string | null, rolling: boolean): { text: string; urgent: boolean } {
  if (rolling || !deadline) return { text: "Rolling deadline", urgent: false };
  const d = new Date(deadline);
  const now = new Date();
  const diff = Math.ceil((d.getTime() - now.getTime()) / 86400_000);
  if (diff < 0) return { text: "Closed", urgent: true };
  if (diff === 0) return { text: "Closes today!", urgent: true };
  if (diff <= 3) return { text: `Closes in ${diff} day${diff === 1 ? "" : "s"}`, urgent: true };
  if (diff <= 14) return { text: `${diff} days left`, urgent: false };
  return {
    text: `Deadline: ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
    urgent: false,
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function fetchSection(type: SectionId, page = 1): Promise<XploreResponse> {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/get-xplore?type=${type}&page=${page}&limit=30`
  );
  if (!res.ok) throw new Error(`get-xplore ${res.status}`);
  return res.json();
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function XploreCard({
  item,
  section,
  saved,
  onSave,
}: {
  item: XploreItem;
  section: SectionId;
  saved: boolean;
  onSave: (item: XploreItem) => void;
}) {
  const { text: deadlineText, urgent } = formatDeadline(item.deadline, item.rolling);

  const chips: string[] = [];
  if (section === "scholarships") {
    if (item.level) chips.push(item.level);
    if (item.funding_type) chips.push(item.funding_type === "full" ? "Full funding" : "Partial");
    if (item.field_of_study) chips.push(item.field_of_study);
    if (item.country) chips.push(item.country);
  } else if (section === "grants") {
    if (item.category) chips.push(item.category);
    if (item.amount && item.currency)
      chips.push(`${item.currency} ${item.amount.toLocaleString()}`);
    if (item.country) chips.push(item.country);
  } else if (section === "internships") {
    if (item.company) chips.push(item.company);
    if (item.remote) chips.push("Remote");
    else if (item.country) chips.push(item.country);
    if (item.duration) chips.push(item.duration);
  }

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-2.5">
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug flex-1 line-clamp-2">{item.title}</p>
        <button
          onClick={() => onSave(item)}
          className="flex-shrink-0 text-muted-foreground hover:text-primary transition mt-0.5"
          aria-label={saved ? "Unsave" : "Save"}
        >
          {saved ? (
            <BookmarkCheck className="h-4 w-4 text-primary" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
      )}

      {/* Chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.slice(0, 3).map((c) => (
            <span
              key={c}
              className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-1.5">
          <Clock className={`h-3 w-3 ${urgent ? "text-destructive" : "text-muted-foreground"}`} />
          <span
            className={`font-mono text-[9px] uppercase tracking-wider ${
              urgent ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {deadlineText}
          </span>
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 font-mono text-[9px] uppercase tracking-wider text-primary-foreground"
          >
            View <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      {/* Source */}
      <p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/60">
        via {item.source} · {timeAgo(item.fetched_at)}
      </p>
    </div>
  );
}

// ─── Section panel ────────────────────────────────────────────────────────────

function SectionPanel({ section }: { section: SectionId }) {
  const [items, setItems] = useState<XploreItem[] | null>(null);
  const [sources, setSources] = useState<XploreResponse["sources"]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [saved, setSaved] = useState<Record<string, XploreItem>>(getSaved);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true);
    fetchSection(section)
      .then((data) => {
        setItems(data.items);
        setSources(data.sources);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [section]);

  const handleSave = (item: XploreItem) => {
    setSaved((prev) => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item;
      setSaved(next);
      return next;
    });
    // persist immediately
    const current = getSaved();
    if (current[item.id]) {
      delete current[item.id];
    } else {
      current[item.id] = item;
    }
    setSaved(current);
  };

  const errCount = sources.filter((s) => s.count === 0).length;

  return (
    <div className="space-y-3">
      {/* Source status bar */}
      {sources.length > 0 && (
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          {items ? `${items.length} listings` : "Loading..."}
          {errCount > 0 && (
            <button
              onClick={() => setShowSources((v) => !v)}
              className="ml-1 flex items-center gap-1 text-amber-500"
            >
              <AlertTriangle className="h-3 w-3" />
              {errCount} source{errCount > 1 ? "s" : ""} empty
            </button>
          )}
        </div>
      )}

      {showSources && (
        <div className="rounded-md border border-border bg-surface-1 p-2 space-y-1">
          {sources.map((s) => (
            <div
              key={s.source}
              className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider"
            >
              <span className="text-muted-foreground">{s.label}</span>
              <span className={s.count === 0 ? "text-amber-500" : "text-muted-foreground"}>
                {s.count} listings · {timeAgo(s.lastFetchedAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-surface-1 border border-border animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-dashed border-destructive/40 bg-surface-1 p-6 text-center">
          <p className="text-sm text-muted-foreground">Failed to load. Check your connection.</p>
          <button
            onClick={() => {
              loaded.current = false;
              setError(null);
              setItems(null);
              setLoading(true);
              fetchSection(section)
                .then((d) => { setItems(d.items); setSources(d.sources); })
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
            }}
            className="mt-3 font-mono text-xs uppercase tracking-wider text-primary"
          >
            Retry →
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && items?.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-surface-1 p-8 text-center">
          <Globe className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            No {section} available right now. Check back soon.
          </p>
        </div>
      )}

      {/* Items */}
      {items && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <XploreCard
              key={item.id}
              item={item}
              section={section}
              saved={!!saved[item.id]}
              onSave={handleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function XplorePage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SectionId>("internships");
  const touchStartX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const idx = SECTIONS.findIndex((s) => s.id === activeSection);
    if (delta > 60 && idx > 0) setActiveSection(SECTIONS[idx - 1].id);
    if (delta < -60 && idx < SECTIONS.length - 1) setActiveSection(SECTIONS[idx + 1].id);
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />
      <main className="mx-auto max-w-md px-4 pt-4 space-y-4">

        {/* Header */}
        <section className="rounded-xl border border-border bg-surface-1 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-sm bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                🧭
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Xplore
              </span>
            </div>
            {/* Jobs shortcut */}
            <button
              onClick={() => navigate({ to: "/jobs" })}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
            >
              <Briefcase className="h-3 w-3" /> Jobs
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Opportunities worldwide — internships, scholarships, and grants updated every few hours.
          </p>
        </section>

        {/* Tab bar */}
        <div className="flex rounded-md border border-border bg-surface-1 p-1">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-sm py-2 font-mono text-[10px] uppercase tracking-wider transition ${
                activeSection === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Content — swipeable */}
        <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <SectionPanel key={activeSection} section={activeSection} />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/xplore")({
  head: () => ({
    meta: [
      { title: "Xplore · WorldTimeline" },
      { name: "description", content: "Discover internships, scholarships, and grants worldwide." },
    ],
  }),
  component: XplorePage,
});
