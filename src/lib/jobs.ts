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
const CACHE_KEY = "worldtimeline_jobs_cache"; // external jobs cache (stale-while-revalidate)
// Cache is trusted at any age now -- it renders instantly no matter how
// stale, and a background refresh keeps it honest. This constant only
// throttles how often that background refresh actually fires, so flipping
// between tabs/routes doesn't spam the edge function.
const BACKGROUND_REFRESH_MIN_AGE_MS = 5 * 60 * 1000; // 5 min
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

// ---- External jobs cache (stale-while-revalidate) ----

interface ExternalCache {
  jobs: JobListing[];
  sources: SourceStatus[];
  cachedAt: string;
}

function readCache(): ExternalCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.jobs)) return null;
    return parsed as ExternalCache;
  } catch {
    return null;
  }
}

function writeCache(jobs: JobListing[], sources: SourceStatus[]) {
  try {
    const cache: ExternalCache = { jobs, sources, cachedAt: new Date().toISOString() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage full or unavailable; not fatal, next session just refetches
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
  fromCache: boolean;
}

async function fetchExternal(): Promise<{ jobs: JobListing[]; sources: SourceStatus[] } | null> {
  try {
    const res = await fetch(GET_JOBS_URL, { method: "POST" });
    if (!res.ok) return null;
    const json = await res.json();
    const jobs = Array.isArray(json?.jobs) ? json.jobs.map(normalizeCachedJob) : [];
    const sources = Array.isArray(json?.sources) ? json.sources : [];
    return { jobs, sources };
  } catch {
    return null;
  }
}

// Live server-side search (q and/or location). Unlike getJobs(), this never
// reads or writes the 1000-row client cache -- it always hits get-jobs
// directly with the search params, which now filter server-side across the
// FULL archive (~5400+ rows within the 31-day window) instead of only the
// newest 1000 that used to be all the cache ever held.
async function searchExternal(q: string, location: string): Promise<{ jobs: JobListing[]; sources: SourceStatus[] } | null> {
  try {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (location) sp.set("location", location);
    const res = await fetch(`${GET_JOBS_URL}?${sp.toString()}`, { method: "POST" });
    if (!res.ok) return null;
    const json = await res.json();
    const jobs = Array.isArray(json?.jobs) ? json.jobs.map(normalizeCachedJob) : [];
    const sources = Array.isArray(json?.sources) ? json.sources : [];
    return { jobs, sources };
  } catch {
    return null;
  }
}

function matchesLocal(job: JobListing, q: string, location: string): boolean {
  if (location && !job.location.toLowerCase().includes(location.toLowerCase())) return false;
  if (!q) return true;
  const ql = q.toLowerCase();
  return (
    job.title.toLowerCase().includes(ql) ||
    job.company.toLowerCase().includes(ql) ||
    job.location.toLowerCase().includes(ql)
  );
}

function mergeAndSort(community: JobListing[], external: JobListing[]): JobListing[] {
  return [...community, ...external].sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );
}

function latestSyncTimestamp(sources: SourceStatus[]): string | null {
  const ts = sources
    .map((s) => s.lastSyncedAt)
    .filter((t): t is string => !!t)
    .map((t) => new Date(t).getTime());
  return ts.length ? new Date(Math.max(...ts)).toISOString() : null;
}

/**
 * ---- DATA SOURCE SEAM ----
 * Community jobs live in localStorage until you're ready to move posting
 * server-side too. External jobs (Arbeitnow, RemoteJobs.org, and any future
 * source) come from the Supabase-cached get-jobs edge function, which
 * already merges every cached provider server-side.
 *
 * ---- CLIENT-SIDE CACHE (stale-while-revalidate, never blocking) ----
 * Any existing cache is returned instantly, however old it is -- the UI
 * should never sit on "Syncing..." just because 30+ minutes passed. A
 * background refresh is kicked off (throttled to once per
 * BACKGROUND_REFRESH_MIN_AGE_MS) so the cache keeps catching up silently.
 * The only time this blocks on the network is the very first visit on a
 * given browser, when there's no cache to show yet.
 */
export async function getJobs(): Promise<JobsFetchResult> {
  const community = readLocal();
  const cache = readCache();

  if (cache) {
    const cacheAge = Date.now() - new Date(cache.cachedAt).getTime();
    if (cacheAge > BACKGROUND_REFRESH_MIN_AGE_MS) {
      fetchExternal().then((fresh) => {
        if (fresh) writeCache(fresh.jobs, fresh.sources);
      });
    }
    return {
      jobs: mergeAndSort(community, cache.jobs),
      lastSyncedAt: latestSyncTimestamp(cache.sources),
      sources: cache.sources,
      fromCache: true,
    };
  }

  // No cache at all -- first-ever visit on this browser. Has to block once.
  const fresh = await fetchExternal();
  if (fresh) {
    writeCache(fresh.jobs, fresh.sources);
    return {
      jobs: mergeAndSort(community, fresh.jobs),
      lastSyncedAt: latestSyncTimestamp(fresh.sources),
      sources: fresh.sources,
      fromCache: false,
    };
  }

  // Network failed entirely and there was never a cache -- nothing to show
  // but whatever's local.
  return { jobs: community, lastSyncedAt: null, sources: [], fromCache: false };
}

/**
 * Live server-side search across the full job archive (see searchExternal).
 * Used instead of getJobs() whenever the Jobs panel has an active keyword
 * or location filter, so a search reaches every row in the archive rather
 * than only whatever happened to be in the 1000-row default cache.
 */
export async function searchJobs(q: string, location: string): Promise<JobsFetchResult> {
  const community = readLocal().filter((j) => matchesLocal(j, q, location));
  const result = await searchExternal(q, location);
  if (!result) return { jobs: community, lastSyncedAt: null, sources: [], fromCache: false };
  return {
    jobs: mergeAndSort(community, result.jobs),
    lastSyncedAt: latestSyncTimestamp(result.sources),
    sources: result.sources,
    fromCache: false,
  };
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
