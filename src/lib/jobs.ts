export type JobType = "Full-time" | "Part-time" | "Contract" | "Remote" | "On-site";
export type JobSource = "community" | "external";

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  type: JobType;
  applyUrl: string;
  description: string;
  postedAt: string;
  source: JobSource;
  tags?: string[];
  logoUrl?: string | null;
}

const STORAGE_KEY = "worldtimeline_jobs";
const GET_JOBS_URL =
  "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/get-jobs";

// ---- Community postings (localStorage) ----

function readLocal(): JobListing[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(jobs: JobListing[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // storage full or unavailable; the new job still shows in this session
  }
}

// ---- Arbeitnow (Supabase-cached, hourly-synced) ----

// deno-lint-ignore no-explicit-any
function mapJobType(job: any): JobType {
  if (job.remote) return "Remote";
  const types: string[] = Array.isArray(job.job_types) ? job.job_types : [];
  if (types.some((t) => /part/i.test(t))) return "Part-time";
  if (types.some((t) => /contract|freelance/i.test(t))) return "Contract";
  if (types.some((t) => /full/i.test(t))) return "Full-time";
  return "On-site";
}

// deno-lint-ignore no-explicit-any
function normalizeCachedJob(job: any): JobListing {
  return {
    id: `ext_${job.id}`,
    title: job.title || "Untitled role",
    company: job.company || "Unknown company",
    location: job.location || (job.remote ? "Remote" : "Not specified"),
    type: mapJobType(job),
    applyUrl: job.url,
    description: job.description
      ? String(job.description).replace(/<[^>]+>/g, "").slice(0, 600)
      : "",
    postedAt: job.created_at || new Date().toISOString(),
    source: "external",
    tags: Array.isArray(job.tags) ? job.tags : [],
    logoUrl: job.logo_url || null,
  };
}

export interface SourceStatus {
  source: string;
  label: string;
  lastSyncedAt: string | null;
  error: string | null;
}

export interface JobsFetchResult {
  jobs: JobListing[];
  lastSyncedAt: string | null;
  sources: SourceStatus[];
}

/**
 * ---- DATA SOURCE SEAM ----
 * Community jobs live in localStorage until you're ready to move posting
 * server-side too. External jobs (Arbeitnow, RemoteJobs.org, and any future
 * source) come from the Supabase-cached get-jobs edge function, which
 * already merges every cached provider server-side. Both are merged here
 * so jobs.tsx doesn't need to know the difference.
 *
 * Freshness is reported per-source (`sources`) rather than as one blended
 * number, so this scales cleanly to any number of future job APIs: the UI
 * shows the freshest sync as its headline and only needs to surface a count
 * of anything delayed, not a growing list of timestamps.
 */
export async function getJobs(): Promise<JobsFetchResult> {
  const community = readLocal();
  let external: JobListing[] = [];
  let sources: SourceStatus[] = [];

  try {
    const res = await fetch(GET_JOBS_URL, { method: "POST" });
    if (res.ok) {
      const json = await res.json();
      external = Array.isArray(json?.jobs) ? json.jobs.map(normalizeCachedJob) : [];
      sources = Array.isArray(json?.sources) ? json.sources : [];
    }
  } catch {
    // Network hiccup reaching Supabase; still show community jobs.
  }

  const merged = [...community, ...external].sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );

  const syncedTimestamps = sources
    .map((s) => s.lastSyncedAt)
    .filter((t): t is string => !!t)
    .map((t) => new Date(t).getTime());
  const lastSyncedAt = syncedTimestamps.length
    ? new Date(Math.max(...syncedTimestamps)).toISOString()
    : null;

  return { jobs: merged, lastSyncedAt, sources };
}

export async function postJob(
  input: Omit<JobListing, "id" | "postedAt" | "source">
): Promise<JobListing> {
  const job: JobListing = {
    ...input,
    id: crypto.randomUUID(),
    postedAt: new Date().toISOString(),
    source: "community",
  };
  writeLocal([job, ...readLocal()]);
  return job;
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
