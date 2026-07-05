import { supabase } from "@/integrations/supabase/client";
import type { JobListing } from "@/lib/jobs";

export const INTEREST_OPTIONS = [
  "Writing",
  "Programming",
  "Modeling",
  "Teaching",
  "Design",
  "Marketing",
  "Sales",
  "Customer Support",
  "Finance",
  "Healthcare",
  "Engineering",
  "Data Science",
  "Legal",
  "Hospitality",
  "Human Resources",
  "Operations",
];

/**
 * Related terms per interest so matching isn't a literal-word-only search.
 * A user picking "Programming" should still catch a "Software Engineer"
 * listing even though the word "programming" never appears in it.
 */
const INTEREST_SYNONYMS: Record<string, string[]> = {
  Writing: ["writer", "content", "copywriter", "editor", "journalist", "blogger"],
  Programming: ["developer", "software", "coding", "programmer", "full stack", "backend", "frontend"],
  Modeling: ["model", "fashion", "photoshoot", "runway"],
  Teaching: ["teacher", "tutor", "instructor", "education", "trainer", "lecturer"],
  Design: ["designer", "ux", "ui", "graphic", "creative", "product design"],
  Marketing: ["growth", "seo", "social media", "brand", "content marketing"],
  Sales: ["account executive", "business development", "sdr", "bdr", "sales rep"],
  "Customer Support": ["support", "helpdesk", "customer service", "customer success"],
  Finance: ["accountant", "accounting", "financial", "bookkeeping", "controller"],
  Healthcare: ["nurse", "medical", "clinical", "doctor", "health", "physician"],
  Engineering: ["engineer", "mechanical", "electrical", "civil engineer"],
  "Data Science": ["data analyst", "machine learning", "analytics", "data scientist", "ml engineer"],
  Legal: ["lawyer", "attorney", "paralegal", "compliance", "counsel"],
  Hospitality: ["hotel", "restaurant", "chef", "tourism", "hospitality"],
  "Human Resources": ["hr", "recruiter", "talent", "people ops", "recruitment"],
  Operations: ["ops", "logistics", "supply chain", "project manager", "operations manager"],
};

export type MatchScore = "strong" | "possible";

export interface JobMatch {
  job: JobListing;
  matchedInterest: string;
  matchedKeyword: string;
  score: MatchScore;
}

/**
 * Counts how many distinct fields (title, tags) a keyword hits. More
 * fields hit = higher confidence this is a real match, not a coincidence.
 */
function scoreAgainstInterest(
  job: JobListing,
  interest: string
): { fieldsHit: number; keyword: string } {
  const title = job.title.toLowerCase();
  const tags = (job.tags ?? []).map((t) => t.toLowerCase());
  const keywords = [interest, ...(INTEREST_SYNONYMS[interest] ?? [])];

  let fieldsHit = 0;
  let matchedKeyword = "";

  for (const kw of keywords) {
    const k = kw.toLowerCase();
    const inTitle = title.includes(k);
    const inTags = tags.some((t) => t.includes(k));
    if (inTitle) fieldsHit++;
    if (inTags) fieldsHit++;
    if ((inTitle || inTags) && !matchedKeyword) matchedKeyword = kw;
  }

  return { fieldsHit, keyword: matchedKeyword };
}

/**
 * Public helper for live displays (e.g. the badge on a job card) that need
 * to score a single job against a single interest using current job data.
 */
export function scoreMatch(job: JobListing, interest: string): MatchScore | null {
  const { fieldsHit } = scoreAgainstInterest(job, interest);
  if (fieldsHit === 0) return null;
  return fieldsHit >= 2 ? "strong" : "possible";
}

/**
 * Keyword-and-synonym matching -- checks each interest (plus its related
 * terms) against the job's title and tags. No ML needed; tags/job_types
 * already carry enough signal from Arbeitnow/RemoteJobs.org, and this is
 * easy to extend later without touching the sync pipeline.
 */
export function computeMatches(jobs: JobListing[], interests: string[]): JobMatch[] {
  if (interests.length === 0) return [];
  const matches: JobMatch[] = [];

  for (const job of jobs) {
    for (const interest of interests) {
      const { fieldsHit, keyword } = scoreAgainstInterest(job, interest);
      if (fieldsHit > 0) {
        matches.push({
          job,
          matchedInterest: interest,
          matchedKeyword: keyword || interest,
          score: fieldsHit >= 2 ? "strong" : "possible",
        });
        break; // one primary match per job keeps the UI simple
      }
    }
  }
  return matches;
}

export async function getMyInterests(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_interests")
    .select("interest")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data.map((r: { interest: string }) => r.interest);
}

/**
 * Replaces the user's full interest list in one go -- simplest mental
 * model for a settings-style picker (diff insert/delete under the hood).
 */
export async function setMyInterests(userId: string, interests: string[]): Promise<void> {
  const current = await getMyInterests(userId);
  const toAdd = interests.filter((i) => !current.includes(i));
  const toRemove = current.filter((i) => !interests.includes(i));

  if (toAdd.length > 0) {
    await supabase
      .from("user_interests")
      .insert(toAdd.map((interest) => ({ user_id: userId, interest })));
  }
  if (toRemove.length > 0) {
    await supabase
      .from("user_interests")
      .delete()
      .eq("user_id", userId)
      .in("interest", toRemove);
  }
}

/**
 * Persists newly-found matches, snapshotting the job's details, score, and
 * matched keyword at the moment of the match. This is deliberate: the
 * hourly-synced cache overwrites itself, so a job that matched an hour ago
 * may no longer be in the live feed -- but the notification history (and
 * the "why" behind it) should still be accurate and complete.
 */
export async function syncMatches(userId: string, matches: JobMatch[]): Promise<void> {
  if (matches.length === 0) return;
  const rows = matches.map((m) => ({
    user_id: userId,
    job_id: m.job.id,
    matched_interest: m.matchedInterest,
    matched_keyword: m.matchedKeyword,
    match_score: m.score,
    job_title: m.job.title,
    job_company: m.job.company,
    job_apply_url: m.job.applyUrl,
    job_location: m.job.location,
    job_type: m.job.type,
  }));
  // onConflict on (user_id, job_id) keeps existing `seen` state untouched
  // for jobs already recorded, and inserts fresh (seen=false) rows for new ones.
  await supabase
    .from("job_matches")
    .upsert(rows, { onConflict: "user_id,job_id", ignoreDuplicates: true });
}

export interface MatchNotification {
  id: string;
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  jobApplyUrl: string;
  jobLocation: string;
  jobType: string;
  matchedInterest: string;
  matchedKeyword: string;
  score: MatchScore | null;
  createdAt: string;
  seen: boolean;
}

export async function getMatchHistory(userId: string): Promise<MatchNotification[]> {
  const { data, error } = await supabase
    .from("job_matches")
    .select(
      "id, job_id, job_title, job_company, job_apply_url, job_location, job_type, matched_interest, matched_keyword, match_score, created_at, seen"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    jobId: r.job_id as string,
    jobTitle: (r.job_title as string) ?? "Untitled role",
    jobCompany: (r.job_company as string) ?? "Unknown company",
    jobApplyUrl: (r.job_apply_url as string) ?? "",
    jobLocation: (r.job_location as string) ?? "",
    jobType: (r.job_type as string) ?? "",
    matchedInterest: r.matched_interest as string,
    matchedKeyword: (r.matched_keyword as string) ?? (r.matched_interest as string),
    score: (r.match_score as MatchScore) ?? null,
    createdAt: r.created_at as string,
    seen: r.seen as boolean,
  }));
}

export async function markOneMatchSeen(matchId: string): Promise<void> {
  await supabase.from("job_matches").update({ seen: true }).eq("id", matchId);
}

export async function clearAllMatches(userId: string): Promise<void> {
  await supabase.from("job_matches").delete().eq("user_id", userId);
}

export async function getUnseenMatchCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from("job_matches")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("seen", false);
  return count ?? 0;
}

export async function markMatchesSeen(userId: string): Promise<void> {
  await supabase
    .from("job_matches")
    .update({ seen: true })
    .eq("user_id", userId)
    .eq("seen", false);
}
