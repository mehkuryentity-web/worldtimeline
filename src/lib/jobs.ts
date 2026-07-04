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
  };
}

export interface JobsFetchResult {
  jobs: JobListing[];
  lastSyncedAt: string | null;
  stale: boolean;
}

/**
 * ---- DATA SOURCE SEAM ----
 * Community jobs live in localStorage until you're ready to move posting
 * server-side too. External jobs (Arbeitnow, RemoteJobs.org, and any future
 * source) come from the Supabase-cached get-jobs edge function, which
 * already merges every cached provider server-side. Both are merged here
 * so jobs.tsx doesn't need to know the difference.
 */
export async function getJobs(): Promise<JobsFetchResult> {
  const community = readLocal();
  let external: JobListing[] = [];
  let lastSyncedAt: string | null = null;
  let stale = false;

  try {
    const res = await fetch(GET_JOBS_URL, { method: "POST" });
    if (res.ok) {
      const json = await res.json();
      external = Array.isArray(json?.jobs) ? json.jobs.map(normalizeCachedJob) : [];
      lastSyncedAt = json?.last_synced_at ?? null;
      stale = !!json?.stale;
    } else {
      stale = true;
    }
  } catch {
    // Network hiccup reaching Supabase; still show community jobs.
    stale = true;
  }

  const merged = [...community, ...external].sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );

  return { jobs: merged, lastSyncedAt, stale };
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
