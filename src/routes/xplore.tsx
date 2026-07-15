import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  GraduationCap, BookOpen, Coins, Briefcase,
  RefreshCw, AlertTriangle, Clock, Globe, ExternalLink,
  Bookmark, BookmarkCheck, Search, SlidersHorizontal,
  MapPin, Target, Send, Check,
  Sparkles, Building2, Eye, Flame, MessageCircle, Share2,
  Flag, CornerDownRight, Plus, X, Heart,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useAppState } from "@/hooks/use-app-state";
import { getJobs, postJob, timeAgo as jobTimeAgo } from "@/lib/jobs";
import type { JobListing, JobType, SourceStatus } from "@/lib/jobs";
import {
  getCurrentUserId, getEngagementCounts, getMyReactions, recordView, toggleInterested,
  addComment, getComments, reportJob, getCommentLikeCounts, getMyCommentLikes, toggleCommentLike,
} from "@/lib/job-engagement";
import type { EngagementCounts, JobComment } from "@/lib/job-engagement";
import {
  INTEREST_CATEGORIES, computeMatches, computeXploreMatches,
  syncMatches, getMyInterests, setMyInterests,
} from "@/lib/xplore-matches";
import type { JobMatch, XploreMatch, XploreCategory } from "@/lib/xplore-matches";

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
  country?: string | null;
  field_of_study?: string | null;
  funding_type?: string | null;
  level?: string | null;
  category?: string | null;
  amount?: number | null;
  currency?: string | null;
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

type PanelId = "jobs" | "internships" | "scholarships" | "grants";
type JobTypeFilter = JobType | "All";
type Recency = "all" | "24h" | "7d" | "30d";

interface GlobalFilters {
  recency: Recency;
  location: string;
  jobType: JobTypeFilter;
  level: string;
  fundingType: string;
  category: string;
}

const DEFAULT_FILTERS: GlobalFilters = {
  recency: "all", location: "", jobType: "All", level: "", fundingType: "", category: "",
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://fadiusjtmtemxvysodie.supabase.co";
const SESSION_KEY = "xplore_session_v2";
const SAVED_KEY = "xplore_saved";
const PAGE_SIZE = 20;
const JOB_TYPES: JobType[] = ["Full-time", "Part-time", "Contract", "Remote", "On-site"];
const RECENCY_OPTIONS = [
  { value: "all" as Recency, label: "Any time" },
  { value: "24h" as Recency, label: "Past 24h" },
  { value: "7d" as Recency, label: "Past week" },
  { value: "30d" as Recency, label: "Past month" },
];

const PANELS: { id: PanelId; label: string; icon: React.ElementType }[] = [
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "internships", label: "Internships", icon: GraduationCap },
  { id: "scholarships", label: "Scholarships", icon: BookOpen },
  { id: "grants", label: "Grants", icon: Coins },
];

// ─── Session ──────────────────────────────────────────────────────────────────

interface XploreSession {
  activePanel: PanelId;
  scrollPositions: Record<PanelId, number>;
}

function readSession(): XploreSession {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) throw new Error();
    return JSON.parse(raw);
  } catch {
    return { activePanel: "jobs", scrollPositions: { jobs: 0, internships: 0, scholarships: 0, grants: 0 } };
  }
}

function writeSession(s: XploreSession) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
}

// ─── Saved ────────────────────────────────────────────────────────────────────

function getSaved(): Record<string, XploreItem> {
  try { const r = localStorage.getItem(SAVED_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}

function toggleSavedItem(item: XploreItem): Record<string, XploreItem> {
  const cur = getSaved();
  if (cur[item.id]) delete cur[item.id]; else cur[item.id] = item;
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(cur)); } catch {}
  return cur;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatDeadline(deadline: string | null, rolling: boolean) {
  if (rolling || !deadline) return { text: "Rolling deadline", urgent: false };
  const d = new Date(deadline);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400_000);
  if (diff < 0) return { text: "Closed", urgent: true };
  if (diff === 0) return { text: "Closes today!", urgent: true };
  if (diff <= 3) return { text: `Closes in ${diff} day${diff === 1 ? "" : "s"}`, urgent: true };
  if (diff <= 14) return { text: `${diff} days left`, urgent: false };
  return { text: `Deadline: ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`, urgent: false };
}

// ─── Client-side cache (stale-while-revalidate) ────────────────────────────
// Server data refreshes on a cron (internships/scholarships every ~2h, grants
// every ~3h), so a 15-minute client cache is safe and eliminates the blocking
// "Loading..." wait on every tab open — cached data renders instantly while
// a background refresh keeps it current.
const XPLORE_CACHE_PREFIX = "xplore_cache_";
const XPLORE_CACHE_MAX_AGE_MS = 15 * 60 * 1000;

interface XploreCacheEntry {
  data: XploreResponse;
  cachedAt: string;
}

function readXploreCache(type: string): XploreCacheEntry | null {
  try {
    const raw = localStorage.getItem(XPLORE_CACHE_PREFIX + type);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    return parsed as XploreCacheEntry;
  } catch {
    return null;
  }
}

function writeXploreCache(type: string, data: XploreResponse) {
  try {
    localStorage.setItem(XPLORE_CACHE_PREFIX + type, JSON.stringify({ data, cachedAt: new Date().toISOString() }));
  } catch {
    // storage full or unavailable; not fatal, next session just refetches
  }
}

async function fetchSectionLive(type: Exclude<PanelId, "jobs">, page = 1): Promise<XploreResponse> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-xplore?type=${type}&page=${page}&limit=30`);
  if (!res.ok) throw new Error(`get-xplore ${res.status}`);
  return res.json();
}

async function fetchSection(type: Exclude<PanelId, "jobs">, page = 1): Promise<XploreResponse> {
  // Cache is keyed by type only (page 1), matching how panels actually use it
  const cache = page === 1 ? readXploreCache(type) : null;
  const cacheAge = cache ? Date.now() - new Date(cache.cachedAt).getTime() : Infinity;

  if (cache && cacheAge < XPLORE_CACHE_MAX_AGE_MS) {
    // Return cached data instantly; refresh in background without blocking.
    fetchSectionLive(type, page).then((fresh) => writeXploreCache(type, fresh)).catch(() => {});
    return cache.data;
  }

  try {
    const fresh = await fetchSectionLive(type, page);
    if (page === 1) writeXploreCache(type, fresh);
    return fresh;
  } catch (e) {
    // Network failed — fall back to stale cache rather than showing an error
    if (cache) return cache.data;
    throw e;
  }
}

// ─── Interests Picker Modal ───────────────────────────────────────────────────

function InterestsPickerModal({
  userId,
  initialInterests,
  onClose,
  onSaved,
}: {
  userId: string;
  initialInterests: string[];
  onClose: () => void;
  onSaved: (interests: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialInterests));
  const [customInput, setCustomInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState(INTEREST_CATEGORIES[0].id);

  const toggle = (kw: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw); else next.add(kw);
      return next;
    });
  };

  const addCustom = () => {
    const v = customInput.trim();
    if (!v) return;
    setSelected((prev) => new Set([...prev, v]));
    setCustomInput("");
  };

  const save = async () => {
    setSaving(true);
    const list = Array.from(selected);
    await setMyInterests(userId, list);
    onSaved(list);
    setSaving(false);
    onClose();
  };

  const currentCat = INTEREST_CATEGORIES.find((c) => c.id === activeCategory)!;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-foreground font-semibold">Your Interests</h2>
        <button onClick={onClose} className="text-muted-foreground"><X className="h-5 w-5" /></button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-2 flex-shrink-0 overflow-x-auto no-scrollbar">
        {INTEREST_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-shrink-0 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
              activeCategory === cat.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <p className="px-4 pb-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground flex-shrink-0">
        {selected.size} selected · tap to pick
      </p>

      {/* Keywords */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex flex-wrap gap-2 pb-3">
          {currentCat.keywords.map((kw) => (
            <button
              key={kw}
              onClick={() => toggle(kw)}
              className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${
                selected.has(kw)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {kw}
            </button>
          ))}
        </div>

        {/* Custom keyword */}
        <div className="flex gap-2 mt-2">
          <input
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
            placeholder="Add your own..."
            className="flex-1 rounded-md border border-border bg-surface-1 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <button
            onClick={addCustom}
            disabled={!customInput.trim()}
            className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Custom added pills */}
        {Array.from(selected).filter(
          (s) => !INTEREST_CATEGORIES.flatMap((c) => c.keywords).includes(s)
        ).length > 0 && (
          <div className="mt-3">
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mb-2">Custom</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(selected)
                .filter((s) => !INTEREST_CATEGORIES.flatMap((c) => c.keywords).includes(s))
                .map((kw) => (
                  <button
                    key={kw}
                    onClick={() => toggle(kw)}
                    className="rounded-full border border-primary bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary"
                  >
                    {kw} ×
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-6 pt-3 border-t border-border flex-shrink-0">
        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-md bg-primary py-3 font-mono text-xs uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving..." : `Save ${selected.size} interest${selected.size === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}

// ─── Post Modal ───────────────────────────────────────────────────────────────

function PostModal({ activePanel, userId, onClose, onPosted }: {
  activePanel: PanelId;
  userId: string | null;
  onClose: () => void;
  onPosted: () => void;
}) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<JobType>("Full-time");
  const [applyUrl, setApplyUrl] = useState("");
  const [description, setDescription] = useState("");
  const [posted, setPosted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const label = PANELS.find((p) => p.id === activePanel)?.label ?? "Listing";

  const canSubmit =
    title.trim().length >= 3 &&
    company.trim().length >= 2 &&
    location.trim().length >= 2 &&
    description.trim().length >= 20 &&
    /^https?:\/\/.+/.test(applyUrl.trim());

  const submit = async () => {
    if (!userId) { navigate({ to: "/auth" }); return; }
    setErr(null);
    if (!canSubmit) { setErr("Fill in every field. Apply/URL link must start with http:// or https://."); return; }
    await postJob({ title: title.trim(), company: company.trim(), location: location.trim(), type, applyUrl: applyUrl.trim(), description: description.trim() });
    setPosted(true);
    setTimeout(() => { onPosted(); onClose(); }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
        <h2 className="font-mono text-[11px] uppercase tracking-wider font-semibold">Post {label}</h2>
        <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {[
          { label: "Title", value: title, set: setTitle, placeholder: `e.g. ${activePanel === "jobs" ? "Frontend Engineer" : activePanel === "internships" ? "Marketing Intern" : activePanel === "scholarships" ? "STEM Scholarship 2025" : "Community Health Grant"}` },
          { label: activePanel === "jobs" || activePanel === "internships" ? "Company / Organisation" : "Awarding Body", value: company, set: setCompany, placeholder: "e.g. WorldTimeline" },
          { label: "Location / Region", value: location, set: setLocation, placeholder: "e.g. Lagos, Nigeria or Global" },
        ].map(({ label, value, set, placeholder }) => (
          <div key={label}>
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
            <input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder}
              className="mt-1 w-full rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm focus:border-primary focus:outline-none" />
          </div>
        ))}

        {(activePanel === "jobs" || activePanel === "internships") && (
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Type</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {JOB_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${type === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {activePanel === "scholarships" || activePanel === "grants" ? "Application / Info URL" : "Apply URL"}
          </label>
          <input value={applyUrl} onChange={(e) => setApplyUrl(e.target.value)} placeholder="https://..."
            className="mt-1 w-full rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm focus:border-primary focus:outline-none" />
        </div>

        <div>
          <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5}
            placeholder="Details, requirements, eligibility..."
            className="mt-1 w-full resize-none rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm focus:border-primary focus:outline-none" />
        </div>

        {err && <p className="text-[11px] text-destructive">{err}</p>}

        <button onClick={submit} disabled={posted}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-mono text-xs uppercase tracking-wider text-primary-foreground disabled:opacity-50">
          {posted ? <><Check className="h-4 w-4" /> Posted!</> : <><Send className="h-4 w-4" /> Post {label}</>}
        </button>
      </div>
    </div>
  );
}

// ─── Xplore Card (with full engagement) ──────────────────────────────────────

function XploreCard({ item, section, saved, onSave, match, userId }: {
  item: XploreItem; section: Exclude<PanelId, "jobs">; saved: boolean;
  onSave: (item: XploreItem) => void; match?: XploreMatch | null;
  userId: string | null;
}) {
  const navigate = useNavigate();
  const { text: deadlineText, urgent } = formatDeadline(item.deadline, item.rolling);

  // Engagement state
  const [counts, setCounts] = useState<EngagementCounts>({ interestedCount: 0, viewCount: 0, commentCount: 0 });
  const [interested, setInterested] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [reported, setReported] = useState(false);
  const viewRecorded = useRef(false);
  const engagementLoaded = useRef(false);

  useEffect(() => {
    if (engagementLoaded.current) return;
    engagementLoaded.current = true;
    getEngagementCounts([item.id]).then((map) => {
      if (map[item.id]) setCounts(map[item.id]);
    });
    if (userId) {
      getMyReactions([item.id], userId).then((set) => setInterested(set.has(item.id)));
    }
  }, [item.id, userId]);

  useEffect(() => {
    if (!userId || viewRecorded.current) return;
    viewRecorded.current = true;
    recordView(item.id, userId).then(() => {
      setCounts((prev) => ({ ...prev, viewCount: prev.viewCount + 1 }));
    });
  }, [item.id, userId]);

  const requireAuth = () => navigate({ to: "/auth" });

  const handleInterested = () => {
    if (!userId) return requireAuth();
    const next = !interested;
    setInterested(next);
    setCounts((prev) => ({ ...prev, interestedCount: prev.interestedCount + (next ? 1 : -1) }));
    toggleInterested(item.id, userId, interested);
  };

  const loadComments = async () => {
    setLoadingComments(true);
    setComments(await getComments(item.id));
    setLoadingComments(false);
  };

  const toggleComments = () => setCommentsOpen((v) => !v);

  const handleShare = async () => {
    try {
      if (item.url && navigator.share) await navigator.share({ title: item.title, url: item.url });
      else if (item.url) { await navigator.clipboard.writeText(item.url); setShared(true); setTimeout(() => setShared(false), 1500); }
    } catch {}
  };

  const handleReport = async () => {
    if (!userId) return requireAuth();
    if (reported) return;
    setReported(true);
    await reportJob(item.id, userId, "flagged_by_user");
  };

  const chips: string[] = [];
  if (section === "scholarships") {
    if (item.level) chips.push(item.level);
    if (item.funding_type) chips.push(item.funding_type === "full" ? "Full funding" : "Partial");
    if (item.field_of_study) chips.push(item.field_of_study);
    if (item.country) chips.push(item.country);
  } else if (section === "grants") {
    if (item.category) chips.push(item.category);
    if (item.amount && item.currency) chips.push(`${item.currency} ${item.amount.toLocaleString()}`);
    if (item.country) chips.push(item.country);
  } else {
    if (item.company) chips.push(item.company);
    if (item.remote) chips.push("Remote");
    else if (item.country) chips.push(item.country);
    if (item.duration) chips.push(item.duration);
  }

  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 space-y-2.5">
      {/* Title + view count */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug flex-1 line-clamp-2">{item.title}</p>
        <span className="flex items-center gap-0.5 font-mono text-[9px] text-muted-foreground flex-shrink-0 mt-0.5">
          <Eye className="h-3 w-3" />{counts.viewCount}
        </span>
      </div>

      {/* Match badge */}
      {match && (
        <div className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs ${match.scorePercent >= 70 ? "bg-accent/10 text-accent" : match.scorePercent >= 40 ? "bg-primary/10 text-primary" : "bg-surface-2 text-muted-foreground"}`}>
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span><strong>{match.scorePercent}% match</strong> · {match.matchedInterest}</span>
        </div>
      )}

      {item.description && <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.slice(0, 3).map((c) => (
            <span key={c} className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{c}</span>
          ))}
        </div>
      )}

      {/* Deadline + View button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Clock className={`h-3 w-3 ${urgent ? "text-destructive" : "text-muted-foreground"}`} />
          <span className={`font-mono text-[9px] uppercase tracking-wider ${urgent ? "text-destructive" : "text-muted-foreground"}`}>{deadlineText}</span>
        </div>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 font-mono text-[9px] uppercase tracking-wider text-primary-foreground">
            View <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      {/* Engagement row */}
      <div className="flex items-center justify-between border-t border-border pt-2">
        <button onClick={handleInterested}
          className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition ${interested ? "text-accent" : "text-muted-foreground hover:text-accent"}`}>
          <Flame className={`h-3.5 w-3.5 ${interested ? "fill-accent" : ""}`} />
          {counts.interestedCount > 0 ? counts.interestedCount : "Interested"}
        </button>
        <button onClick={toggleComments}
          className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <MessageCircle className="h-3.5 w-3.5" />
          {counts.commentCount > 0 ? counts.commentCount : "Comment"}
        </button>
        <button onClick={handleShare}
          className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <Share2 className="h-3.5 w-3.5" />{shared ? "Copied" : "Share"}
        </button>
        <button onClick={() => onSave(item)}
          className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition ${saved ? "text-primary" : "text-muted-foreground hover:text-primary"}`}>
          <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-primary" : ""}`} />
        </button>
        <button onClick={handleReport} disabled={reported}
          className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive disabled:opacity-50">
          <Flag className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Comments */}
      {commentsOpen && (
        <CommentThread itemId={item.id} userId={userId} onCountChange={(d) => setCounts((prev) => ({ ...prev, commentCount: prev.commentCount + d }))} />
      )}

      <p className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/60">via {item.source} · {timeAgo(item.fetched_at)}</p>
    </div>
  );
}

// ─── Shared Comment Thread (YouTube-style flat threading + likes) ────────────

function CommentThread({ itemId, userId, onCountChange }: {
  itemId: string; userId: string | null; onCountChange: (delta: number) => void;
}) {
  const navigate = useNavigate();
  const [comments, setComments] = useState<JobComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ topLevelId: string; snippet: string } | null>(null);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const list = await getComments(itemId);
    setComments(list);
    const ids = list.map((c) => c.id);
    const [counts, mine] = await Promise.all([
      getCommentLikeCounts(ids),
      userId ? getMyCommentLikes(ids, userId) : Promise.resolve(new Set<string>()),
    ]);
    setLikeCounts(counts);
    setMyLikes(mine);
    setLoading(false);
  };

  useEffect(() => { load(); }, [itemId]);

  const requireAuth = () => navigate({ to: "/auth" });

  // Flatten: find each comment's top-level ancestor so all replies (any depth)
  // group under one thread — matches YouTube's flat reply behaviour.
  const topLevelOf = (id: string): string => {
    let cur = comments.find((c) => c.id === id);
    while (cur?.parentId) {
      const parent = comments.find((c) => c.id === cur!.parentId);
      if (!parent) break;
      cur = parent;
    }
    return cur?.id ?? id;
  };

  const topLevelComments = comments.filter((c) => !c.parentId);
  const repliesFor = (topId: string) => comments.filter((c) => c.parentId && topLevelOf(c.id) === topId);

  const submit = async () => {
    if (!userId) return requireAuth();
    const text = draft.trim();
    if (!text) return;
    const parentId = replyingTo?.topLevelId ?? null;
    await addComment(itemId, userId, text, parentId);
    setDraft("");
    setReplyingTo(null);
    onCountChange(1);
    load();
    if (parentId) setExpandedThreads((prev) => new Set(prev).add(parentId));
  };

  const startReply = (topLevelId: string, snippet: string) => {
    setReplyingTo({ topLevelId, snippet: snippet.slice(0, 40) });
  };

  const toggleThread = (id: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleLike = (commentId: string) => {
    if (!userId) return requireAuth();
    const liked = myLikes.has(commentId);
    setMyLikes((prev) => { const next = new Set(prev); if (liked) next.delete(commentId); else next.add(commentId); return next; });
    setLikeCounts((prev) => ({ ...prev, [commentId]: (prev[commentId] ?? 0) + (liked ? -1 : 1) }));
    toggleCommentLike(commentId, userId, liked);
  };

  const CommentRow = ({ comment, isReply }: { comment: JobComment; isReply: boolean }) => {
    const liked = myLikes.has(comment.id);
    const likeCount = likeCounts[comment.id] ?? 0;
    return (
      <div className={isReply ? "ml-4 flex items-start gap-1.5" : ""}>
        {isReply && <CornerDownRight className="mt-2 h-3 w-3 shrink-0 text-muted-foreground" />}
        <div className="flex-1 rounded-md bg-surface-2 px-2.5 py-2 text-xs">
          <p>{comment.content}</p>
          <div className="mt-1 flex items-center gap-3 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            <span>{jobTimeAgo(comment.createdAt)}</span>
            <button onClick={() => handleLike(comment.id)} className={`flex items-center gap-1 transition ${liked ? "text-destructive" : "hover:text-destructive"}`}>
              <Heart className={`h-3 w-3 ${liked ? "fill-destructive" : ""}`} />
              {likeCount > 0 ? likeCount : "Like"}
            </button>
            <button onClick={() => startReply(topLevelOf(comment.id), comment.content)} className="hover:text-primary">Reply</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2 border-t border-border pt-2">
      {loading ? (
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Loading comments...</p>
      ) : topLevelComments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      ) : (
        topLevelComments.map((c) => {
          const replies = repliesFor(c.id);
          const expanded = expandedThreads.has(c.id);
          return (
            <div key={c.id} className="space-y-1.5">
              <CommentRow comment={c} isReply={false} />
              {replies.length > 0 && (
                <button onClick={() => toggleThread(c.id)}
                  className="ml-1 font-mono text-[9px] uppercase tracking-wider text-primary">
                  {expanded ? "Hide" : "View"} {replies.length} repl{replies.length === 1 ? "y" : "ies"}
                </button>
              )}
              {expanded && (
                <div className="space-y-1.5">
                  {replies.map((r) => <CommentRow key={r.id} comment={r} isReply />)}
                </div>
              )}
            </div>
          );
        })
      )}

      <div className="pt-1">
        {replyingTo && (
          <div className="mb-1.5 flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1">
            <span className="flex-1 truncate text-[10px] text-muted-foreground">Replying to: "{replyingTo.snippet}..."</span>
            <button onClick={() => setReplyingTo(null)} className="text-muted-foreground"><X className="h-3 w-3" /></button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={userId ? (replyingTo ? "Write a reply..." : "Add a comment...") : "Sign in to comment"} disabled={!userId}
            className="flex-1 rounded-md border border-border bg-surface-1 px-2.5 py-1.5 text-xs focus:border-primary focus:outline-none disabled:opacity-50" />
          <button onClick={submit} disabled={!draft.trim()} className="rounded-md bg-primary p-1.5 text-primary-foreground disabled:opacity-50">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Job Card (inline, trimmed) ───────────────────────────────────────────────

function InlineJobCard({ job, userId, counts, interested, isSaved, match, onCountsChange, onInterestedChange, onToggleSave }: {
  job: JobListing; userId: string | null; counts: EngagementCounts; interested: boolean;
  isSaved: boolean; match?: JobMatch | null;
  onCountsChange: (id: string, u: (c: EngagementCounts) => EngagementCounts) => void;
  onInterestedChange: (id: string, v: boolean) => void;
  onToggleSave: (job: JobListing) => void;
}) {
  const navigate = useNavigate();
  const c = counts ?? { interestedCount: 0, viewCount: 0, commentCount: 0 };
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [reported, setReported] = useState(false);
  const viewRecorded = useRef(false);

  useEffect(() => {
    if (!userId || viewRecorded.current) return;
    viewRecorded.current = true;
    recordView(job.id, userId).then(() => {
      onCountsChange(job.id, (prev) => ({ ...prev, viewCount: prev.viewCount + 1 }));
    });
  }, [userId, job.id]);

  const requireAuth = () => navigate({ to: "/auth" });
  const handleInterested = () => {
    if (!userId) return requireAuth();
    const next = !interested;
    onInterestedChange(job.id, next);
    onCountsChange(job.id, (prev) => ({ ...prev, interestedCount: prev.interestedCount + (next ? 1 : -1) }));
    toggleInterested(job.id, userId, interested);
  };
  const toggleComments = () => setCommentsOpen((v) => !v);
  const handleShare = async () => {
    try {
      if (navigator.share) await navigator.share({ title: job.title, text: `${job.title} at ${job.company}`, url: job.applyUrl });
      else { await navigator.clipboard.writeText(job.applyUrl); setShared(true); setTimeout(() => setShared(false), 1500); }
    } catch {}
  };
  const handleReport = async () => {
    if (!userId) return requireAuth();
    if (reported) return;
    setReported(true);
    await reportJob(job.id, userId, "flagged_by_user");
  };

  return (
    <article className="rounded-md border border-border bg-surface-1 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {job.logoUrl ? (
            <img src={job.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-md border border-border object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2"><Building2 className="h-4 w-4 text-muted-foreground" /></div>
          )}
          <div>
            <h3 className="text-sm font-semibold">{job.title}</h3>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">{job.company}</div>
          </div>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">{job.type}</span>
      </div>

      {match && (
        <div className={`mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs ${match.scorePercent >= 70 ? "bg-accent/10 text-accent" : match.scorePercent >= 40 ? "bg-primary/10 text-primary" : "bg-surface-2 text-muted-foreground"}`}>
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span><strong>{match.scorePercent}% match</strong> · {match.matchedInterest}</span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" /> {job.location}
        <span className="ml-auto flex items-center gap-2 font-mono text-[10px]">
          <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> {c.viewCount}</span>
          {jobTimeAgo(job.postedAt)}
        </span>
      </div>

      {job.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{job.description}</p>}

      <a href={job.applyUrl} target="_blank" rel="noopener noreferrer"
        className="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-primary py-2 font-mono text-[11px] uppercase tracking-wider text-primary-foreground">
        Learn More <ExternalLink className="h-3 w-3" />
      </a>

      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        <button onClick={handleInterested} className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition ${interested ? "text-accent" : "text-muted-foreground hover:text-accent"}`}>
          <Flame className={`h-3.5 w-3.5 ${interested ? "fill-accent" : ""}`} />
          {c.interestedCount > 0 ? c.interestedCount : "Interested"}
        </button>
        <button onClick={toggleComments} className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <MessageCircle className="h-3.5 w-3.5" />{c.commentCount > 0 ? c.commentCount : "Comment"}
        </button>
        <button onClick={handleShare} className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <Share2 className="h-3.5 w-3.5" />{shared ? "Copied" : "Share"}
        </button>
        <button onClick={() => onToggleSave(job)} className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition ${isSaved ? "text-primary" : "text-muted-foreground hover:text-primary"}`}>
          <Bookmark className={`h-3.5 w-3.5 ${isSaved ? "fill-primary" : ""}`} />
        </button>
        <button onClick={handleReport} disabled={reported} className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive disabled:opacity-50">
          <Flag className="h-3.5 w-3.5" />
        </button>
      </div>

      {commentsOpen && (
        <CommentThread itemId={job.id} userId={userId} onCountChange={(d) => onCountsChange(job.id, (prev) => ({ ...prev, commentCount: prev.commentCount + d }))} />
      )}
    </article>
  );
}

// ─── Matches Modal (full-screen, curated across all 4 categories) ────────────

interface UnifiedMatch {
  key: string;
  category: PanelId;
  scorePercent: number;
  matchedInterest: string;
  job?: JobListing;
  xploreItem?: XploreItem;
}

function MatchesModal({ userId, interests, onClose, onEditInterests }: {
  userId: string; interests: string[]; onClose: () => void; onEditInterests: () => void;
}) {
  const { update: updateAppState, state: appState } = useAppState();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<UnifiedMatch[]>([]);
  const [engagementMap, setEngagementMap] = useState<Record<string, EngagementCounts>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Record<string, XploreItem>>(getSaved);
  const [activeFilter, setActiveFilter] = useState<"all" | PanelId>("all");
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    if (interests.length === 0) { setLoading(false); return; }

    (async () => {
      const [jobsResult, internships, scholarships, grants] = await Promise.all([
        getJobs(),
        fetchSection("internships").catch(() => ({ items: [] } as Partial<XploreResponse>)),
        fetchSection("scholarships").catch(() => ({ items: [] } as Partial<XploreResponse>)),
        fetchSection("grants").catch(() => ({ items: [] } as Partial<XploreResponse>)),
      ]);

      const jobMatches = computeMatches(jobsResult.jobs, interests);
      const unified: UnifiedMatch[] = jobMatches.map((m) => ({
        key: `jobs_${m.job.id}`, category: "jobs", scorePercent: m.scorePercent, matchedInterest: m.matchedInterest, job: m.job,
      }));

      for (const [cat, items] of [
        ["internships", internships.items ?? []],
        ["scholarships", scholarships.items ?? []],
        ["grants", grants.items ?? []],
      ] as [XploreCategory, XploreItem[]][]) {
        const catMatches = computeXploreMatches(items, interests, cat);
        for (const m of catMatches) {
          const item = items.find((i) => i.id === m.itemId);
          if (item) unified.push({ key: `${cat}_${item.id}`, category: cat, scorePercent: m.scorePercent, matchedInterest: m.matchedInterest, xploreItem: item });
        }
      }

      // Highest match percentage first
      unified.sort((a, b) => b.scorePercent - a.scorePercent);
      setMatches(unified);

      // Load engagement for job matches only (xplore cards load their own internally)
      const jobIds = unified.filter((m) => m.job).map((m) => m.job!.id);
      if (jobIds.length > 0) {
        const [counts, mine] = await Promise.all([
          getEngagementCounts(jobIds),
          userId ? getMyReactions(jobIds, userId) : Promise.resolve(new Set<string>()),
        ]);
        setEngagementMap(counts);
        setMyReactions(mine);
      }
      setLoading(false);
    })();
  }, [interests, userId]);

  const handleCountsChange = (jobId: string, updater: (c: EngagementCounts) => EngagementCounts) => {
    setEngagementMap((prev) => ({ ...prev, [jobId]: updater(prev[jobId] ?? { interestedCount: 0, viewCount: 0, commentCount: 0 }) }));
  };
  const handleInterestedChange = (jobId: string, interested: boolean) => {
    setMyReactions((prev) => { const next = new Set(prev); if (interested) next.add(jobId); else next.delete(jobId); return next; });
  };
  const handleToggleSaveJob = (job: JobListing) => {
    updateAppState((s) => {
      const next = { ...(s.saved ?? {}) };
      if (next[job.id]) delete next[job.id];
      else next[job.id] = { id: job.id, title: job.title, summary: job.description, url: job.applyUrl, source: job.company, region: job.location, category: "Jobs", publishedAt: job.postedAt, savedAt: new Date().toISOString() };
      return { ...s, saved: next };
    });
  };

  const filteredMatches = activeFilter === "all" ? matches : matches.filter((m) => m.category === activeFilter);
  const countByCategory = (cat: PanelId) => matches.filter((m) => m.category === cat).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
        <div>
          <h2 className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider font-semibold"><Target className="h-4 w-4 text-primary" /> Your Matches</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{matches.length} matches across all categories</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onEditInterests}
            className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-primary hover:border-primary transition">
            <SlidersHorizontal className="h-3 w-3" /> Interests
          </button>
          <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
      </div>

      {interests.length > 0 && (
        <div className="flex gap-1.5 px-4 pt-3 pb-2 flex-shrink-0 overflow-x-auto no-scrollbar">
          {(["all", ...PANELS.map((p) => p.id)] as ("all" | PanelId)[]).map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`flex-shrink-0 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition whitespace-nowrap ${
                activeFilter === f ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
              }`}>
              {f === "all" ? `All (${matches.length})` : `${PANELS.find((p) => p.id === f)?.label} (${countByCategory(f)})`}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {interests.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-surface-1 p-8 text-center">
            <Target className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-3">Set your interests to see curated matches across jobs, internships, scholarships & grants.</p>
            <button onClick={onEditInterests} className="rounded-md bg-primary px-4 py-2 font-mono text-xs uppercase tracking-wider text-primary-foreground">Set interests</button>
          </div>
        ) : loading ? (
          <div className="mt-3 space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-surface-1 border border-border animate-pulse" />)}
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-surface-1 p-8 text-center">
            <Globe className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No matches yet in this category. Check back after the next sync.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {filteredMatches.map((m) =>
              m.job ? (
                <InlineJobCard key={m.key} job={m.job} userId={userId} counts={engagementMap[m.job.id]}
                  interested={myReactions.has(m.job.id)} isSaved={!!appState.saved?.[m.job.id]}
                  match={{ job: m.job, matchedInterest: m.matchedInterest, matchedKeyword: m.matchedInterest, scorePercent: m.scorePercent, matchedInterests: [m.matchedInterest] }}
                  onCountsChange={handleCountsChange} onInterestedChange={handleInterestedChange} onToggleSave={handleToggleSaveJob} />
              ) : m.xploreItem ? (
                <XploreCard key={m.key} item={m.xploreItem} section={m.category as Exclude<PanelId, "jobs">}
                  saved={!!saved[m.xploreItem.id]} onSave={(i) => setSaved(toggleSavedItem(i))}
                  match={{ itemId: m.xploreItem.id, itemTitle: m.xploreItem.title, matchedInterest: m.matchedInterest, matchedKeyword: m.matchedInterest, scorePercent: m.scorePercent, matchedInterests: [m.matchedInterest], category: m.category as XploreCategory }}
                  userId={userId} />
              ) : null
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Jobs Panel ───────────────────────────────────────────────────────────────

function JobsPanel({ scrollRef, isActive, onScroll, onScrollImmediate, userId, interests, onOpenInterests, query, filters }: {
  scrollRef: React.RefObject<HTMLDivElement>; isActive: boolean; onScroll: (y: number) => void;
  onScrollImmediate: (y: number) => void;
  userId: string | null; interests: string[]; onOpenInterests: () => void; query: string; filters: GlobalFilters;
}) {
  const { update: updateAppState, state: appState } = useAppState();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [showSourceDetail, setShowSourceDetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [engagementMap, setEngagementMap] = useState<Record<string, EngagementCounts>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const [matchInfo, setMatchInfo] = useState<Map<string, JobMatch>>(new Map());
  const loaded = useRef(false);
  const scrollRestored = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getJobs();
    setJobs(result.jobs);
    setLastSyncedAt(result.lastSyncedAt);
    setSources(result.sources);
    setLoading(false);
    const ids = result.jobs.map((j) => j.id);
    const [counts, mine] = await Promise.all([
      getEngagementCounts(ids),
      userId ? getMyReactions(ids, userId) : Promise.resolve(new Set<string>()),
    ]);
    setEngagementMap(counts);
    setMyReactions(mine);
  }, [userId]);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    load();
  }, [load]);

  useEffect(() => {
    if (!userId || interests.length === 0 || jobs.length === 0) { setMatchInfo(new Map()); return; }
    const matches = computeMatches(jobs, interests);
    setMatchInfo(new Map(matches.map((m) => [m.job.id, m])));
    syncMatches(userId, matches);
  }, [jobs, interests, userId]);



  useEffect(() => {
    if (!isActive || scrollRestored.current || !scrollRef.current) return;
    scrollRestored.current = true;
    const pos = readSession().scrollPositions["jobs"] ?? 0;
    if (pos > 0) setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = pos; }, 60);
  }, [isActive, scrollRef]);

  const rafRef = useRef<number | null>(null);
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const y = scrollRef.current.scrollTop;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        onScrollImmediate(y);
        rafRef.current = null;
      });
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onScroll(y), 300);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const loc = filters.location.trim().toLowerCase();
    const recencyMs: Record<Exclude<Recency, "all">, number> = { "24h": 86400000, "7d": 604800000, "30d": 2592000000 };
    const now = Date.now();
    return jobs.filter((j) => {
      if (filters.jobType !== "All" && j.type !== filters.jobType) return false;
      if (loc && !j.location.toLowerCase().includes(loc)) return false;
      if (filters.recency !== "all" && now - new Date(j.postedAt).getTime() > recencyMs[filters.recency]) return false;
      if (!q) return true;
      return j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || j.location.toLowerCase().includes(q);
    });
  }, [jobs, query, filters]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query, filters]);

  const handleCountsChange = (jobId: string, updater: (c: EngagementCounts) => EngagementCounts) => {
    setEngagementMap((prev) => ({ ...prev, [jobId]: updater(prev[jobId] ?? { interestedCount: 0, viewCount: 0, commentCount: 0 }) }));
  };
  const handleInterestedChange = (jobId: string, interested: boolean) => {
    setMyReactions((prev) => { const next = new Set(prev); if (interested) next.add(jobId); else next.delete(jobId); return next; });
  };
  const handleToggleSave = (job: JobListing) => {
    updateAppState((s) => {
      const next = { ...(s.saved ?? {}) };
      if (next[job.id]) delete next[job.id];
      else next[job.id] = { id: job.id, title: job.title, summary: job.description, url: job.applyUrl, source: job.company, region: job.location, category: "Jobs", publishedAt: job.postedAt, savedAt: new Date().toISOString() };
      return { ...s, saved: next };
    });
  };

  const matchedJobs = Array.from(matchInfo.values());
  const visibleJobs = filtered.slice(0, visibleCount);

  return (
    <div ref={scrollRef} className="absolute inset-0 overflow-y-auto" onScroll={handleScroll}>
      <div className="px-4 pt-3 pb-6 space-y-3">
        {true && (
          <>
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              {lastSyncedAt ? `Updated ${jobTimeAgo(lastSyncedAt)} · ${filtered.length} shown` : loading ? "Syncing..." : `${filtered.length} shown`}
              {sources.filter((s) => s.error).length > 0 && (
                <button onClick={() => setShowSourceDetail((v) => !v)} className="ml-1 flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3 w-3" />{sources.filter((s) => s.error).length} delayed
                </button>
              )}
            </div>
            {showSourceDetail && (
              <div className="space-y-1 rounded-md border border-border bg-surface-1 p-2">
                {sources.map((s) => (
                  <div key={s.source} className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className={s.error ? "text-destructive" : "text-muted-foreground"}>{s.lastSyncedAt ? jobTimeAgo(s.lastSyncedAt) : "never"}{s.error ? " · failing" : ""}</span>
                  </div>
                ))}
              </div>
            )}

            {loading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-md bg-surface-1 border border-border animate-pulse" />)}</div>
            ) : visibleJobs.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-surface-1 p-6 text-center">
                <p className="text-sm text-muted-foreground">{jobs.length === 0 ? "No jobs available right now." : "No jobs match your search."}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleJobs.map((j) => (
                  <InlineJobCard key={j.id} job={j} userId={userId} counts={engagementMap[j.id]}
                    interested={myReactions.has(j.id)} isSaved={!!appState.saved?.[j.id]} match={matchInfo.get(j.id) ?? null}
                    onCountsChange={handleCountsChange} onInterestedChange={handleInterestedChange} onToggleSave={handleToggleSave} />
                ))}
                {visibleCount < filtered.length && (
                  <button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                    className="w-full rounded-md border border-border bg-surface-1 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Load more ({filtered.length - visibleCount} remaining)
                  </button>
                )}
              </div>
            )}
          </>
        )}


      </div>
    </div>
  );
}

// ─── Xplore Section Panel ─────────────────────────────────────────────────────

function XploreSectionPanel({ section, isActive, scrollRef, onScroll, onScrollImmediate, interests, query, userId, filters }: {
  section: Exclude<PanelId, "jobs">; isActive: boolean;
  scrollRef: React.RefObject<HTMLDivElement>; onScroll: (y: number) => void;
  onScrollImmediate: (y: number) => void;
  interests: string[]; query: string; userId: string | null; filters: GlobalFilters;
}) {
  const [items, setItems] = useState<XploreItem[] | null>(null);
  const [sources, setSources] = useState<XploreResponse["sources"]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [saved, setSaved] = useState<Record<string, XploreItem>>(getSaved);
  const [xploreMatches, setXploreMatches] = useState<Map<string, XploreMatch>>(new Map());
  const loaded = useRef(false);
  const scrollRestored = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    fetchSection(section)
      .then((data) => { setItems(data.items); setSources(data.sources); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [section]);

  useEffect(() => { if (loaded.current) return; loaded.current = true; load(); }, [load]);

  useEffect(() => {
    if (!items || scrollRestored.current || !isActive || !scrollRef.current) return;
    scrollRestored.current = true;
    const pos = readSession().scrollPositions[section] ?? 0;
    if (pos > 0) setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = pos; }, 60);
  }, [items, isActive, section, scrollRef]);

  useEffect(() => {
    if (!items || interests.length === 0) { setXploreMatches(new Map()); return; }
    const matches = computeXploreMatches(items, interests, section as XploreCategory);
    setXploreMatches(new Map(matches.map((m) => [m.itemId, m])));
  }, [items, interests, section]);

  const rafRef = useRef<number | null>(null);
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const y = scrollRef.current.scrollTop;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        onScrollImmediate(y);
        rafRef.current = null;
      });
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onScroll(y), 300);
  };

  const filteredItems = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const loc = filters.location.trim().toLowerCase();
    const recencyMs: Record<Exclude<Recency, "all">, number> = { "24h": 86400000, "7d": 604800000, "30d": 2592000000 };
    const now = Date.now();
    return items.filter((i) => {
      if (loc) {
        const itemCountry = (i.country ?? "").toLowerCase();
        if (!itemCountry.includes(loc)) return false;
      }
      if (filters.recency !== "all" && now - new Date(i.fetched_at).getTime() > recencyMs[filters.recency]) return false;
      if (section === "scholarships") {
        if (filters.level && i.level !== filters.level) return false;
        if (filters.fundingType && i.funding_type !== filters.fundingType) return false;
      }
      if (section === "grants" && filters.category && i.category !== filters.category) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        (i.source ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, query, filters, section]);

  const errCount = sources.filter((s) => s.count === 0).length;

  return (
    <div ref={scrollRef} className="absolute inset-0 overflow-y-auto" onScroll={handleScroll}>
      <div className="px-4 pt-3 pb-6 space-y-3">
        {sources.length > 0 && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            {items ? `${filteredItems.length} listings` : "Loading..."}
            {errCount > 0 && (
              <button onClick={() => setShowSources((v) => !v)} className="ml-1 flex items-center gap-1 text-amber-500">
                <AlertTriangle className="h-3 w-3" />{errCount} source{errCount > 1 ? "s" : ""} empty
              </button>
            )}
          </div>
        )}
        {showSources && (
          <div className="rounded-md border border-border bg-surface-1 p-2 space-y-1">
            {sources.map((s) => (
              <div key={s.source} className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider">
                <span className="text-muted-foreground">{s.label}</span>
                <span className={s.count === 0 ? "text-amber-500" : "text-muted-foreground"}>{s.count} · {timeAgo(s.lastFetchedAt)}</span>
              </div>
            ))}
          </div>
        )}
        {loading && <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-surface-1 border border-border animate-pulse" />)}</div>}
        {error && (
          <div className="rounded-xl border border-dashed border-destructive/40 bg-surface-1 p-6 text-center">
            <p className="text-sm text-muted-foreground">Failed to load.</p>
            <button onClick={() => { loaded.current = false; load(); }} className="mt-3 font-mono text-xs uppercase tracking-wider text-primary">Retry →</button>
          </div>
        )}
        {!loading && !error && filteredItems.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface-1 p-8 text-center">
            <Globe className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No {section} available right now.</p>
          </div>
        )}
        {filteredItems.length > 0 && (
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <XploreCard key={item.id} item={item} section={section} saved={!!saved[item.id]}
                onSave={(i) => setSaved(toggleSavedItem(i))} match={xploreMatches.get(item.id) ?? null}
                userId={userId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function XplorePage() {
  const navigate = useNavigate();
  const session = useRef<XploreSession>(readSession());
  const [activePanel, setActivePanel] = useState<PanelId>(session.current.activePanel);
  const [userId, setUserId] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [showInterests, setShowInterests] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<GlobalFilters>(DEFAULT_FILTERS);
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v !== DEFAULT_FILTERS[k as keyof GlobalFilters]).length;

  const scrollRefs: Record<PanelId, React.RefObject<HTMLDivElement>> = {
    jobs: useRef<HTMLDivElement>(null),
    internships: useRef<HTMLDivElement>(null),
    scholarships: useRef<HTMLDivElement>(null),
    grants: useRef<HTMLDivElement>(null),
  };

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<PanelId, HTMLButtonElement>>>({});
  const headerRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);
  const headerVisible = useRef(true);
  const [headerShown, setHeaderShown] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(999);

  useEffect(() => {
    const measure = () => {
      if (headerRef.current) setHeaderHeight(headerRef.current.scrollHeight);
    };
    // Measure after paint so dynamically-shown filter panel is accounted for
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [filtersOpen, activePanel]);

  useEffect(() => {
    getCurrentUserId().then((uid) => {
      setUserId(uid);
      if (uid) getMyInterests(uid).then(setInterests);
    });
  }, []);

  const handleScroll = useCallback((panel: PanelId, y: number) => {
    // Debounced — only persists scroll position to localStorage
    session.current = { ...session.current, scrollPositions: { ...session.current.scrollPositions, [panel]: y } };
    writeSession(session.current);
  }, []);

  // Immediate (rAF-throttled, not debounced) — drives header hide/show in real time
  const handleScrollImmediate = useCallback((y: number) => {
    const delta = y - lastScrollY.current;
    lastScrollY.current = y;
    if (y <= 60) {
      // Always show near the top, regardless of direction
      if (!headerVisible.current) { headerVisible.current = true; setHeaderShown(true); }
      return;
    }
    if (delta > 4 && headerVisible.current) {
      headerVisible.current = false;
      setHeaderShown(false);
    } else if (delta < -4 && !headerVisible.current) {
      headerVisible.current = true;
      setHeaderShown(true);
    }
  }, []);

  const switchPanel = useCallback((next: PanelId) => {
    const cur = scrollRefs[activePanel].current;
    if (cur) {
      session.current = { ...session.current, scrollPositions: { ...session.current.scrollPositions, [activePanel]: cur.scrollTop } };
    }
    session.current = { ...session.current, activePanel: next };
    writeSession(session.current);
    setActivePanel(next);
    // Reset the scroll-direction baseline to the tab we're switching into,
    // and always show the header on an explicit tab switch — otherwise the
    // next scroll event compares against the wrong panel's position.
    lastScrollY.current = session.current.scrollPositions[next] ?? 0;
    headerVisible.current = true;
    setHeaderShown(true);
    // Auto-scroll active tab into centre view
    setTimeout(() => {
      const btn = tabRefs.current[next];
      if (btn) btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, 50);
  }, [activePanel, scrollRefs]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null; touchStartY.current = null;
    if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 60) return;
    const idx = PANELS.findIndex((p) => p.id === activePanel);
    if (dx > 0 && idx > 0) switchPanel(PANELS[idx - 1].id);
    if (dx < 0 && idx < PANELS.length - 1) switchPanel(PANELS[idx + 1].id);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar />

      <div className="mx-auto w-full max-w-md flex flex-col flex-1 overflow-hidden pb-20">
        {/* Header + Search + Tab bar — collapses via max-height so feed fills the space */}
        <div
          style={{
            maxHeight: headerShown ? `${headerHeight}px` : "0px",
            overflow: "hidden",
            transition: "max-height 220ms ease",
          }}
          className="flex-shrink-0 bg-background"
        >
          <div ref={headerRef}>
            {/* Xplore branding row */}
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded-sm bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground">🧭</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Xplore</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { if (!userId) navigate({ to: "/auth" }); else setShowMatches(true); }}
                    className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground hover:text-primary hover:border-primary transition">
                    <Target className="h-3 w-3" /> Matches
                  </button>
                  <button onClick={() => setShowPost(true)}
                    className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-primary-foreground">
                    <Plus className="h-3 w-3" /> Post
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Jobs, internships, scholarships & grants — updated every few hours.</p>
            </div>

            {/* Global search + Filters toggle */}
            <div className="px-4 pb-2 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={globalQuery} onChange={(e) => setGlobalQuery(e.target.value)}
                  placeholder={`Search ${activePanel}...`}
                  className="w-full rounded-md border border-border bg-surface-1 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none" />
              </div>
              <button onClick={() => setFiltersOpen((v) => !v)}
                className={`relative flex items-center gap-1 rounded-md border px-2.5 py-2 font-mono text-[10px] uppercase tracking-wider transition ${
                  filtersOpen || activeFilterCount > 0 ? "border-primary text-primary" : "border-border text-muted-foreground"
                }`}>
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[8px] text-primary-foreground">{activeFilterCount}</span>
                )}
              </button>
            </div>

            {/* Context-aware filter panel — fields change per active tab */}
            {filtersOpen && (
              <div className="px-4 pb-2">
                <div className="space-y-3 rounded-md border border-border bg-surface-1 p-3">
                  {/* Location/Country — shared across all tabs */}
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input value={filters.location} onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
                      placeholder={activePanel === "jobs" || activePanel === "internships" ? "Filter by location" : "Filter by country"}
                      className="w-full rounded-md border border-border bg-surface-2 py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none" />
                  </div>

                  {/* Jobs / Internships — Type chips */}
                  {(activePanel === "jobs" || activePanel === "internships") && (
                    <div className="flex flex-wrap gap-1.5">
                      {["All", ...JOB_TYPES].map((t) => (
                        <button key={t} onClick={() => setFilters((f) => ({ ...f, jobType: t as JobTypeFilter }))}
                          className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition ${filters.jobType === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{t}</button>
                      ))}
                    </div>
                  )}

                  {/* Scholarships — Level + Funding type */}
                  {activePanel === "scholarships" && (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {["", "Undergraduate", "Postgraduate", "PhD"].map((lvl) => (
                          <button key={lvl || "any"} onClick={() => setFilters((f) => ({ ...f, level: lvl }))}
                            className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition ${filters.level === lvl ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{lvl || "Any level"}</button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {["", "full", "partial"].map((ft) => (
                          <button key={ft || "any"} onClick={() => setFilters((f) => ({ ...f, fundingType: ft }))}
                            className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition ${filters.fundingType === ft ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{ft === "full" ? "Full funding" : ft === "partial" ? "Partial" : "Any funding"}</button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Grants — Category */}
                  {activePanel === "grants" && (
                    <div className="relative">
                      <input value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                        placeholder="Filter by category (e.g. government, nonprofit)"
                        className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm focus:border-primary focus:outline-none" />
                    </div>
                  )}

                  {/* Recency — shared across all tabs */}
                  <div className="flex flex-wrap gap-1.5">
                    {RECENCY_OPTIONS.map((r) => (
                      <button key={r.value} onClick={() => setFilters((f) => ({ ...f, recency: r.value }))}
                        className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition ${filters.recency === r.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{r.label}</button>
                    ))}
                  </div>

                  {activeFilterCount > 0 && (
                    <button onClick={() => setFilters(DEFAULT_FILTERS)}
                      className="font-mono text-[10px] uppercase tracking-wider text-destructive">Clear all filters</button>
                  )}
                </div>
              </div>
            )}

            {/* Panel tab bar — horizontally scrollable, no overlap */}
            <div className="px-4 pb-3">
              <div
                ref={tabBarRef}
                className="flex overflow-x-auto no-scrollbar rounded-md border border-border bg-surface-1 p-1 gap-1"
              >
                {PANELS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    ref={(el) => { if (el) tabRefs.current[id] = el; }}
                    onClick={() => switchPanel(id)}
                    className={`flex flex-shrink-0 items-center justify-center gap-1.5 rounded-sm px-4 py-2 font-mono text-[10px] uppercase tracking-wider transition whitespace-nowrap ${
                      activePanel === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Swipeable panels */}
        <div className="flex-1 relative overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {PANELS.map(({ id }, idx) => {
            const activeIdx = PANELS.findIndex((p) => p.id === activePanel);
            const offset = (idx - activeIdx) * 100;
            return (
              <div key={id} style={{ transform: `translateX(${offset}%)`, transition: "transform 200ms ease", position: "absolute", inset: 0, pointerEvents: activePanel === id ? "auto" : "none" }}>
                {id === "jobs" ? (
                  <JobsPanel scrollRef={scrollRefs.jobs} isActive={activePanel === "jobs"}
                    onScroll={(y) => handleScroll("jobs", y)} onScrollImmediate={handleScrollImmediate}
                    userId={userId} interests={interests}
                    onOpenInterests={() => { if (!userId) navigate({ to: "/auth" }); else setShowInterests(true); }}
                    query={globalQuery} filters={filters} />
                ) : (
                  <XploreSectionPanel section={id} isActive={activePanel === id}
                    scrollRef={scrollRefs[id]} onScroll={(y) => handleScroll(id, y)} onScrollImmediate={handleScrollImmediate}
                    interests={interests} query={globalQuery} userId={userId} filters={filters} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav />

      {/* Modals */}
      {showInterests && userId && (
        <InterestsPickerModal userId={userId} initialInterests={interests} onClose={() => setShowInterests(false)}
          onSaved={(next) => { setInterests(next); setShowInterests(false); }} />
      )}
      {showMatches && userId && (
        <MatchesModal userId={userId} interests={interests} onClose={() => setShowMatches(false)}
          onEditInterests={() => { setShowMatches(false); setShowInterests(true); }} />
      )}
      {showPost && (
        <PostModal activePanel={activePanel} userId={userId} onClose={() => setShowPost(false)} onPosted={() => {}} />
      )}
    </div>
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/xplore")({
  head: () => ({
    meta: [
      { title: "Xplore · WorldTimeline" },
      { name: "description", content: "Discover jobs, internships, scholarships, and grants worldwide." },
    ],
  }),
  component: XplorePage,
});
