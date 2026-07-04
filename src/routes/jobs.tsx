import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Search,
  MapPin,
  Check,
  Send,
  RefreshCw,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { JobCard } from "@/components/JobCard";
import { useAppState } from "@/hooks/use-app-state";
import { getJobs, postJob, timeAgo } from "@/lib/jobs";
import type { JobListing, JobType } from "@/lib/jobs";
import {
  getCurrentUserId,
  getEngagementCounts,
  getMyReactions,
} from "@/lib/job-engagement";
import type { EngagementCounts } from "@/lib/job-engagement";

export const Route = createFileRoute("/jobs")({
  head: () => ({
    meta: [
      { title: "Jobs · WorldTimeline" },
      { name: "description", content: "Browse and post job opportunities on WorldTimeline." },
    ],
  }),
  component: JobsPage,
});

const JOB_TYPES: JobType[] = ["Full-time", "Part-time", "Contract", "Remote", "On-site"];

type Recency = "all" | "24h" | "7d" | "30d";

const RECENCY_OPTIONS: { value: Recency; label: string }[] = [
  { value: "all", label: "Any time" },
  { value: "24h", label: "Past 24h" },
  { value: "7d", label: "Past week" },
  { value: "30d", label: "Past month" },
];

function JobsPage() {
  const { update: updateAppState, state: appState } = useAppState();
  const [tab, setTab] = useState<"browse" | "post">("browse");
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<JobType | "All">("All");
  const [locationQuery, setLocationQuery] = useState("");
  const [recency, setRecency] = useState<Recency>("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [engagementMap, setEngagementMap] = useState<Record<string, EngagementCounts>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());

  // Post form state
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<JobType>("Full-time");
  const [applyUrl, setApplyUrl] = useState("");
  const [description, setDescription] = useState("");
  const [posted, setPosted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadJobs = async () => {
    setLoading(true);
    const result = await getJobs();
    setJobs(result.jobs);
    setLastSyncedAt(result.lastSyncedAt);
    setStale(result.stale);
    setLoading(false);

    const ids = result.jobs.map((j) => j.id);
    const [uid, counts] = await Promise.all([
      getCurrentUserId(),
      getEngagementCounts(ids),
    ]);
    setUserId(uid);
    setEngagementMap(counts);
    if (uid) {
      const mine = await getMyReactions(ids, uid);
      setMyReactions(mine);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleCountsChange = (
    jobId: string,
    updater: (c: EngagementCounts) => EngagementCounts
  ) => {
    setEngagementMap((prev) => ({
      ...prev,
      [jobId]: updater(prev[jobId] ?? { interestedCount: 0, viewCount: 0, commentCount: 0 }),
    }));
  };

  const handleInterestedChange = (jobId: string, interested: boolean) => {
    setMyReactions((prev) => {
      const next = new Set(prev);
      if (interested) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  };

  const handleToggleSave = (job: JobListing) => {
    updateAppState((s) => {
      const next = { ...(s.saved ?? {}) };
      if (next[job.id]) {
        delete next[job.id];
      } else {
        next[job.id] = {
          id: job.id,
          title: job.title,
          summary: job.description,
          url: job.applyUrl,
          source: job.company,
          region: job.location,
          category: "Jobs",
          publishedAt: job.postedAt,
          savedAt: new Date().toISOString(),
        };
      }
      return { ...s, saved: next };
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const loc = locationQuery.trim().toLowerCase();
    const recencyMs: Record<Exclude<Recency, "all">, number> = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };
    const now = Date.now();

    return jobs.filter((j) => {
      const matchesType = typeFilter === "All" || j.type === typeFilter;
      if (!matchesType) return false;

      if (loc && !j.location.toLowerCase().includes(loc)) return false;

      if (recency !== "all") {
        const age = now - new Date(j.postedAt).getTime();
        if (age > recencyMs[recency]) return false;
      }

      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q)
      );
    });
  }, [jobs, query, typeFilter, locationQuery, recency]);

  const canSubmit =
    title.trim().length >= 3 &&
    company.trim().length >= 2 &&
    location.trim().length >= 2 &&
    description.trim().length >= 20 &&
    /^https?:\/\/.+/.test(applyUrl.trim());

  const submit = async () => {
    setErr(null);
    if (!canSubmit) {
      setErr("Fill in every field. Apply link must start with http:// or https://.");
      return;
    }
    await postJob({
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      type,
      applyUrl: applyUrl.trim(),
      description: description.trim(),
    });
    setPosted(true);
    setTitle("");
    setCompany("");
    setLocation("");
    setType("Full-time");
    setApplyUrl("");
    setDescription("");
    await loadJobs();
    setTimeout(() => {
      setPosted(false);
      setTab("browse");
    }, 900);
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <TopBar />
      <main className="mx-auto max-w-md space-y-4 px-4 pt-4">
        <section className="rounded-xl border border-border bg-surface-1 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-sm bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
              <Briefcase className="inline h-3 w-3" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Jobs board
            </span>
          </div>
          <h1 className="mt-2 text-lg font-semibold tracking-tight">Find or post work</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live listings plus community postings.
          </p>
          <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            {lastSyncedAt
              ? `Listings synced ${timeAgo(lastSyncedAt)}`
              : loading
                ? "Syncing listings..."
                : "Sync pending"}
            {stale && <span className="text-destructive">· showing last known data</span>}
          </div>
        </section>

        <div className="flex rounded-md border border-border bg-surface-1 p-1">
          <button
            onClick={() => setTab("browse")}
            className={`flex-1 rounded-sm py-2 font-mono text-[11px] uppercase tracking-wider transition ${
              tab === "browse"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setTab("post")}
            className={`flex-1 rounded-sm py-2 font-mono text-[11px] uppercase tracking-wider transition ${
              tab === "post"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            Post a job
          </button>
        </div>

        {tab === "browse" ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, company, location"
                className="w-full rounded-md border border-border bg-surface-1 py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Filter by location (e.g. Berlin, Remote)"
                className="w-full rounded-md border border-border bg-surface-1 py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setTypeFilter("All")}
                className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                  typeFilter === "All"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                All
              </button>
              {JOB_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                    typeFilter === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {RECENCY_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRecency(r.value)}
                  className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                    recency === r.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-10 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Loading jobs...
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-surface-1 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {jobs.length === 0
                    ? "No jobs available right now."
                    : "No jobs match your search."}
                </p>
                {jobs.length === 0 && (
                  <button
                    onClick={() => setTab("post")}
                    className="mt-3 font-mono text-xs uppercase tracking-wider text-primary"
                  >
                    Be the first to post one →
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((j) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    userId={userId}
                    counts={engagementMap[j.id]}
                    interested={myReactions.has(j.id)}
                    isSaved={!!appState.saved?.[j.id]}
                    onCountsChange={handleCountsChange}
                    onInterestedChange={handleInterestedChange}
                    onToggleSave={handleToggleSave}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Job title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Frontend Engineer"
                className="mt-1 w-full rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Company
              </label>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. WorldTimeline Inc."
                className="mt-1 w-full rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Location
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Lagos, Nigeria or Remote"
                className="mt-1 w-full rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Type
              </label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {JOB_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${
                      type === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Apply URL
              </label>
              <input
                value={applyUrl}
                onChange={(e) => setApplyUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder="Role, responsibilities, requirements..."
                className="mt-1 w-full resize-none rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
            </div>

            {err && <p className="text-[11px] text-destructive">{err}</p>}

            <button
              onClick={submit}
              disabled={posted}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 font-mono text-xs uppercase tracking-wider text-primary-foreground transition disabled:opacity-50"
            >
              {posted ? (
                <>
                  <Check className="h-4 w-4" /> Posted
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Post job
                </>
              )}
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
