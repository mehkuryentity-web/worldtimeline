import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Search,
  MapPin,
  Building2,
  ExternalLink,
  Check,
  Send,
  RefreshCw,
  Users,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { getJobs, postJob, timeAgo } from "@/lib/jobs";
import type { JobListing, JobType } from "@/lib/jobs";

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

function JobsPage() {
  const [tab, setTab] = useState<"browse" | "post">("browse");
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<JobType | "All">("All");

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
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      const matchesType = typeFilter === "All" || j.type === typeFilter;
      if (!matchesType) return false;
      if (!q) return true;
      return (
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q)
      );
    });
  }, [jobs, query, typeFilter]);

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
                  <article
                    key={j.id}
                    className="rounded-md border border-border bg-surface-1 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">{j.title}</h3>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" /> {j.company}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          {j.type}
                        </span>
                        {j.source === "community" && (
                          <span className="flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">
                            <Users className="h-2.5 w-2.5" /> Community
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {j.location}
                      <span className="ml-auto font-mono text-[10px]">
                        {timeAgo(j.postedAt)}
                      </span>
                    </div>
                    {j.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {j.description}
                      </p>
                    )}
                    <a
                      href={j.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-primary py-2 font-mono text-[11px] uppercase tracking-wider text-primary-foreground"
                    >
                      Apply <ExternalLink className="h-3 w-3" />
                    </a>
                  </article>
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
