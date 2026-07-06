import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  Search,
  MapPin,
  Check,
  Send,
  RefreshCw,
  Target,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { JobCard } from "@/components/JobCard";
import { InterestsPicker } from "@/components/InterestsPicker";
import { useAppState } from "@/hooks/use-app-state";
import { getJobs, postJob, timeAgo } from "@/lib/jobs";
import type { JobListing, JobType } from "@/lib/jobs";
import {
  getCurrentUserId,
  getEngagementCounts,
  getMyReactions,
} from "@/lib/job-engagement";
import type { EngagementCounts } from "@/lib/job-engagement";
import {
  getMyInterests,
  computeMatches,
  syncMatches,
  markMatchesSeen,
} from "@/lib/job-matches";
import type { JobMatch } from "@/lib/job-matches";

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
const PAGE_SIZE = 20;
const TABS = ["browse", "matches", "post"] as const;
type Tab = (typeof TABS)[number];

type Recency = "all" | "24h" | "7d" | "30d";

const RECENCY_OPTIONS: { value: Recency; label: string }[] = [
  { value: "all", label: "Any time" },
  { value: "24h", label: "Past 24h" },
  { value: "7d", label: "Past week" },
  { value: "30d", label: "Past month" },
];

function JobsPage() {
  const navigate = useNavigate();
  const { update: updateAppState, state: appState } = useAppState();

  const [tab, setTab] = useState<Tab>("browse");
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<JobType | "All">("All");
  const [locationQuery, setLocationQuery] = useState("");
  const [recency, setRecency] = useState<Recency>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [userId, setUserId] = useState<string | null>(null);
  const [engagementMap, setEngagementMap] = useState<Record<string, EngagementCounts>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());

  const [interests, setInterests] = useState<string[]>([]);
  const [matchInfo, setMatchInfo] = useState<Map<string, JobMatch>>(new Map());
  const [showInterestsPicker, setShowInterestsPicker] = useState(false);

  // Post form state
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<JobType>("Full-time");
  const [applyUrl, setApplyUrl] = useState("");
  const [description, setDescription] = useState("");
  const [posted, setPosted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const touchStartX = useRef<number | null>(null);

  const loadJobs = async () => {
    setLoading(true);
    const result = await getJobs();
    setJobs(result.jobs);
    setLastSyncedAt(result.lastSyncedAt);
    setLoading(false);

    const ids = result.jobs.map((j) => j.id);
    const uid = await getCurrentUserId(); // local session read, no network round-trip
    const [counts, mine, myInterests] = await Promise.all([
      getEngagementCounts(ids),
      uid ? getMyReactions(ids, uid) : Promise.resolve(new Set<string>()),
      uid ? getMyInterests(uid) : Promise.resolve([]),
    ]);
    setUserId(uid);
    setEngagementMap(counts);
    setMyReactions(mine);
    setInterests(myInterests);
  };

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    if (!userId || interests.length === 0 || jobs.length === 0) {
      setMatchInfo(new Map());
      return;
    }
    const matches = computeMatches(jobs, interests);
    setMatchInfo(new Map(matches.map((m) => [m.job.id, m])));
    syncMatches(userId, matches);
  }, [jobs, interests, userId]);

  // Opening the Matches tab counts as having seen whatever's there.
  useEffect(() => {
    if (tab === "matches" && userId) {
      markMatchesSeen(userId);
    }
  }, [tab, userId]);

  const handleInterestsSaved = (next: string[]) => {
    setInterests(next);
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

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, typeFilter, locationQuery, recency]);

  const visibleJobs = filtered.slice(0, visibleCount);
  const matchedJobs = Array.from(matchInfo.values());

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

  const goToTab = (index: number) => {
    const clamped = Math.max(0, Math.min(TABS.length - 1, index));
    setTab(TABS[clamped]);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const currentIndex = TABS.indexOf(tab);
    if (delta > 60) goToTab(currentIndex - 1); // swipe right -> previous tab
    else if (delta < -60) goToTab(currentIndex + 1); // swipe left -> next tab
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
              Jobs
            </span>
          </div>
        </section>

        <div className="flex rounded-md border border-border bg-surface-1 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-sm py-2 font-mono text-[11px] uppercase tracking-wider transition ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "browse" ? "Browse" : t === "matches" ? "Matches" : "Post"}
            </button>
          ))}
        </div>

        <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {tab === "browse" && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title, company, or location"
                  className="w-full rounded-md border border-border bg-surface-1 py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>

              <button
                onClick={() => setFiltersOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-2.5 text-sm text-muted-foreground"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
                </span>
                <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-primary">
                  {filtersOpen ? "Hide" : "Show"}
                  {filtersOpen ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </span>
              </button>

              {filtersOpen && (
                <div className="space-y-3 rounded-md border border-border bg-surface-1 p-3">
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                      placeholder="Filter by location (e.g. Berlin, Remote)"
                      className="w-full rounded-md border border-border bg-surface-2 py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
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
                </div>
              )}

              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                {lastSyncedAt
                  ? `Feed updated ${timeAgo(lastSyncedAt)} · refreshes hourly · ${filtered.length} shown`
                  : loading
                    ? "Syncing listings..."
                    : `${filtered.length} shown`}
              </div>

              {loading ? (
                <div className="py-10 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Loading jobs...
                </div>
              ) : visibleJobs.length === 0 ? (
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
                  {visibleJobs.map((j) => (
                    <JobCard
                      key={j.id}
                      job={j}
                      userId={userId}
                      counts={engagementMap[j.id]}
                      interested={myReactions.has(j.id)}
                      isSaved={!!appState.saved?.[j.id]}
                      match={matchInfo.get(j.id) ?? null}
                      onCountsChange={handleCountsChange}
                      onInterestedChange={handleInterestedChange}
                      onToggleSave={handleToggleSave}
                    />
                  ))}
                  {visibleCount < filtered.length && (
                    <button
                      onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                      className="w-full rounded-md border border-border bg-surface-1 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    >
                      Load more ({filtered.length - visibleCount} remaining)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "matches" && (
            <div className="space-y-3">
              {!userId ? (
                <div className="rounded-xl border border-border bg-surface-1 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Sign in to set interests and get matched.
                  </p>
                  <button
                    onClick={() => navigate({ to: "/auth" })}
                    className="mt-3 font-mono text-xs uppercase tracking-wider text-primary"
                  >
                    Sign in →
                  </button>
                </div>
              ) : showInterestsPicker ? (
                <InterestsPicker
                  userId={userId}
                  initialInterests={interests}
                  onClose={() => setShowInterestsPicker(false)}
                  onSaved={handleInterestsSaved}
                />
              ) : (
                <>
                  <div className="rounded-xl border border-border bg-surface-1 p-4">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                        <Target className="h-4 w-4 text-primary" /> Your interests
                      </h2>
                      <button
                        onClick={() => setShowInterestsPicker(true)}
                        className="font-mono text-[10px] uppercase tracking-wider text-primary underline"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      We match new job posts across the globe to your interests and notify you
                      here.
                    </p>
                    {interests.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {interests.map((i) => (
                          <span
                            key={i}
                            className="rounded-full bg-accent/20 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-accent"
                          >
                            {i}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {interests.length === 0 ? (
                    <button
                      onClick={() => setShowInterestsPicker(true)}
                      className="w-full rounded-md bg-primary py-2.5 font-mono text-xs uppercase tracking-wider text-primary-foreground"
                    >
                      Set your interests
                    </button>
                  ) : (
                    <>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {matchedJobs.length} matching role{matchedJobs.length === 1 ? "" : "s"}{" "}
                        across the globe.
                      </p>
                      {matchedJobs.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border bg-surface-1 p-6 text-center">
                          <p className="text-sm text-muted-foreground">
                            No matches yet. Check back after the next sync.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {matchedJobs.map((m) => (
                            <JobCard
                              key={m.job.id}
                              job={m.job}
                              userId={userId}
                              counts={engagementMap[m.job.id]}
                              interested={myReactions.has(m.job.id)}
                              isSaved={!!appState.saved?.[m.job.id]}
                              match={m}
                              onCountsChange={handleCountsChange}
                              onInterestedChange={handleInterestedChange}
                              onToggleSave={handleToggleSave}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "post" && (
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
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
