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

const JOB_TYPES: JobType[] = ["Full-time", "Part-time", "Contract", "Remote"];

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
            Live listings plus community postings. No points involved.
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
