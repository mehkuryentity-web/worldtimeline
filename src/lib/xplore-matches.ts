import { supabase } from "@/integrations/supabase/client";
import type { JobListing } from "@/lib/jobs";

// ─── Category-grouped interest options ───────────────────────────────────────

export interface InterestCategory {
  id: string;
  label: string;
  keywords: string[];
}

export const INTEREST_CATEGORIES: InterestCategory[] = [
  {
    id: "jobs",
    label: "Jobs",
    keywords: [
      "Programming", "Design", "Marketing", "Sales", "Finance",
      "Healthcare", "Engineering", "Data Science", "Legal",
      "Human Resources", "Operations", "Customer Support",
      "Teaching", "Writing", "Hospitality", "Modeling",
    ],
  },
  {
    id: "internships",
    label: "Internships",
    keywords: [
      "Software Development", "Research", "Product Management",
      "Graphic Design", "Business Development", "Data Analysis",
      "Journalism", "Public Policy", "Architecture", "Accounting",
      "Environmental Science", "Machine Learning", "Social Work", "Film & Media",
    ],
  },
  {
    id: "scholarships",
    label: "Scholarships",
    keywords: [
      "STEM", "Arts & Humanities", "Medicine", "Law", "Education",
      "Business", "Agriculture", "Social Sciences", "Computer Science",
      "Architecture", "Journalism", "Public Health", "Economics", "Music",
    ],
  },
  {
    id: "grants",
    label: "Grants",
    keywords: [
      "Nonprofit", "Climate & Environment", "Health", "Technology",
      "Arts", "Education", "Community Development", "Research",
      "Women & Girls", "Agriculture", "Human Rights", "Entrepreneurship",
      "Youth", "Housing",
    ],
  },
];

// All keywords flat (for backward compat with job matching)
export const ALL_INTERESTS: string[] = [
  ...new Set(INTEREST_CATEGORIES.flatMap((c) => c.keywords)),
];

// Which categories a keyword belongs to
function categoriesForKeyword(keyword: string): string[] {
  return INTEREST_CATEGORIES
    .filter((c) => c.keywords.includes(keyword))
    .map((c) => c.id);
}

// ─── Synonyms (extended from original + xplore-specific) ─────────────────────

const INTEREST_SYNONYMS: Record<string, string[]> = {
  // Jobs
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
  // Internships
  "Software Development": ["developer", "software", "coding", "programmer", "frontend", "backend"],
  Research: ["researcher", "lab", "study", "analysis", "investigation"],
  "Product Management": ["product manager", "pm", "roadmap", "product owner"],
  "Graphic Design": ["designer", "visual", "illustrator", "adobe", "figma"],
  "Business Development": ["bizdev", "partnerships", "growth", "strategy"],
  "Data Analysis": ["data analyst", "analytics", "sql", "excel", "tableau"],
  Journalism: ["reporter", "editor", "media", "news", "correspondent"],
  "Public Policy": ["policy", "government", "advocacy", "legislation"],
  Architecture: ["architect", "building", "urban planning", "autocad"],
  Accounting: ["accountant", "bookkeeping", "audit", "cpa"],
  "Environmental Science": ["environment", "ecology", "sustainability", "climate"],
  "Machine Learning": ["ml", "ai", "deep learning", "neural", "nlp"],
  "Social Work": ["social worker", "counselor", "community", "welfare"],
  "Film & Media": ["film", "video", "media", "production", "cinematography"],
  // Scholarships
  STEM: ["science", "technology", "engineering", "mathematics", "stem"],
  "Arts & Humanities": ["arts", "humanities", "literature", "philosophy", "history"],
  Medicine: ["medical", "nursing", "pharmacy", "dentistry", "clinical"],
  Law: ["legal", "lawyer", "attorney", "jurisprudence"],
  Education: ["teaching", "pedagogy", "curriculum", "schooling"],
  Business: ["management", "mba", "entrepreneurship", "commerce"],
  Agriculture: ["farming", "agronomy", "food science", "agricultural"],
  "Social Sciences": ["sociology", "psychology", "anthropology", "political science"],
  "Computer Science": ["cs", "computing", "software", "algorithms"],
  "Public Health": ["epidemiology", "health policy", "global health"],
  Economics: ["economic", "finance", "macroeconomics", "microeconomics"],
  Music: ["musical", "composition", "performance", "instrument"],
  // Grants
  Nonprofit: ["ngo", "charity", "501c3", "foundation", "civil society"],
  "Climate & Environment": ["climate", "environment", "sustainability", "green", "carbon"],
  Health: ["healthcare", "medical", "wellness", "public health"],
  Technology: ["tech", "software", "digital", "innovation", "startup"],
  Arts: ["art", "culture", "creative", "museum", "gallery"],
  "Community Development": ["community", "neighborhood", "local", "grassroots"],
  "Women & Girls": ["women", "girls", "gender", "female empowerment"],
  "Human Rights": ["rights", "justice", "equality", "advocacy", "democracy"],
  Entrepreneurship: ["startup", "founder", "small business", "entrepreneur"],
  Housing: ["housing", "shelter", "affordable", "homelessness"],
  Youth: ["youth", "young people", "children", "teen", "student"],
};

// ─── Match types ──────────────────────────────────────────────────────────────

export type XploreCategory = "jobs" | "internships" | "scholarships" | "grants";

export interface XploreMatch {
  itemId: string;
  itemTitle: string;
  matchedInterest: string;
  matchedKeyword: string;
  scorePercent: number; // 0–100, ranking signal — not a filter category
  matchedInterests: string[];
  category: XploreCategory;
}

export interface JobMatch {
  job: JobListing;
  matchedInterest: string;
  matchedKeyword: string;
  scorePercent: number; // 0–100, ranking signal — not a filter category
  matchedInterests: string[];
}

// ─── Scoring ──────────────────────────────────────────────────────────────────
// Weighted percentage model: each interest that matches an item contributes
// points based on WHERE it matched (title is the strongest signal, tags next,
// description weakest). Points from distinct matching interests stack,
// capped at 100. This replaces the old binary strong/possible flag with a
// real ranking signal so "Matches" can sort by relevance, not just filter.

const FIELD_WEIGHT = { title: 45, tag: 30, description: 20 } as const;

function keywordsFor(interest: string): string[] {
  return [interest, ...(INTEREST_SYNONYMS[interest] ?? [])].map((k) => k.toLowerCase());
}

// Best single-field weight this interest earns against a job (title > tags > description)
function jobInterestWeight(job: JobListing, interest: string): { weight: number; keyword: string } {
  const title = job.title.toLowerCase();
  const tags = (job.tags ?? []).map((t) => t.toLowerCase());
  const desc = (job.description ?? "").toLowerCase();
  let weight = 0;
  let keyword = "";
  for (const kw of keywordsFor(interest)) {
    if (title.includes(kw) && FIELD_WEIGHT.title > weight) { weight = FIELD_WEIGHT.title; keyword = kw; }
    else if (tags.some((t) => t.includes(kw)) && FIELD_WEIGHT.tag > weight) { weight = FIELD_WEIGHT.tag; keyword = kw; }
    else if (desc.includes(kw) && FIELD_WEIGHT.description > weight) { weight = FIELD_WEIGHT.description; keyword = kw; }
  }
  return { weight, keyword };
}

// Best single-field weight this interest earns against a generic xplore item (title > description)
function xploreInterestWeight(
  title: string, description: string | null, interest: string
): { weight: number; keyword: string } {
  const t = title.toLowerCase();
  const d = (description ?? "").toLowerCase();
  let weight = 0;
  let keyword = "";
  for (const kw of keywordsFor(interest)) {
    if (t.includes(kw) && FIELD_WEIGHT.title > weight) { weight = FIELD_WEIGHT.title; keyword = kw; }
    else if (d.includes(kw) && FIELD_WEIGHT.description > weight) { weight = FIELD_WEIGHT.description; keyword = kw; }
  }
  return { weight, keyword };
}

// Score a generic xplore item against ALL relevant interests, returning a 0-100 percentage
export function scoreXploreItem(
  title: string,
  description: string | null,
  candidateInterests: string[]
): { scorePercent: number; topInterest: string; matchedInterests: string[] } {
  let total = 0;
  let topInterest = "";
  let topWeight = 0;
  const matched: string[] = [];
  for (const interest of candidateInterests) {
    const { weight } = xploreInterestWeight(title, description, interest);
    if (weight > 0) {
      total += weight;
      matched.push(interest);
      if (weight > topWeight) { topWeight = weight; topInterest = interest; }
    }
  }
  return { scorePercent: Math.min(100, total), topInterest, matchedInterests: matched };
}

// Score a job against ALL relevant interests, returning a 0-100 percentage
export function scoreJob(
  job: JobListing,
  candidateInterests: string[]
): { scorePercent: number; topInterest: string; matchedInterests: string[] } {
  let total = 0;
  let topInterest = "";
  let topWeight = 0;
  const matched: string[] = [];
  for (const interest of candidateInterests) {
    const { weight } = jobInterestWeight(job, interest);
    if (weight > 0) {
      total += weight;
      matched.push(interest);
      if (weight > topWeight) { topWeight = weight; topInterest = interest; }
    }
  }
  return { scorePercent: Math.min(100, total), topInterest, matchedInterests: matched };
}

export function computeMatches(jobs: JobListing[], interests: string[]): JobMatch[] {
  if (interests.length === 0) return [];
  const matches: JobMatch[] = [];
  for (const job of jobs) {
    const { scorePercent, topInterest, matchedInterests } = scoreJob(job, interests);
    if (scorePercent > 0) {
      matches.push({ job, matchedInterest: topInterest, matchedKeyword: topInterest, scorePercent, matchedInterests });
    }
  }
  return matches.sort((a, b) => b.scorePercent - a.scorePercent);
}

// Match xplore items (scholarships/grants/internships) against interests
export function computeXploreMatches(
  items: { id: string; title: string; description: string | null }[],
  interests: string[],
  category: XploreCategory
): XploreMatch[] {
  if (interests.length === 0) return [];
  // Only score interests relevant to this category
  const categoryInterests = interests.filter((i) => categoriesForKeyword(i).includes(category));
  const activeInterests = categoryInterests.length > 0 ? categoryInterests : interests;
  const matches: XploreMatch[] = [];
  for (const item of items) {
    const { scorePercent, topInterest, matchedInterests } = scoreXploreItem(item.title, item.description, activeInterests);
    if (scorePercent > 0) {
      matches.push({
        itemId: item.id, itemTitle: item.title, matchedInterest: topInterest,
        matchedKeyword: topInterest, scorePercent, matchedInterests, category,
      });
    }
  }
  return matches.sort((a, b) => b.scorePercent - a.scorePercent);
}

// ─── Supabase persistence ─────────────────────────────────────────────────────

export async function getMyInterests(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_interests")
    .select("interest")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data.map((r: { interest: string }) => r.interest);
}

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

export async function syncMatches(userId: string, matches: JobMatch[]): Promise<void> {
  if (matches.length === 0) return;
  const rows = matches.map((m) => ({
    user_id: userId,
    job_id: m.job.id,
    matched_interest: m.matchedInterest,
    matched_keyword: m.matchedKeyword,
    match_score: String(m.scorePercent),
    job_title: m.job.title,
    job_company: m.job.company,
    job_apply_url: m.job.applyUrl,
    job_location: m.job.location,
    job_type: m.job.type,
  }));
  await supabase
    .from("job_matches")
    .upsert(rows, { onConflict: "user_id,job_id", ignoreDuplicates: true });
}

export async function getMatchHistory(userId: string) {
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
    scorePercent: Number(r.match_score) || 0,
    createdAt: r.created_at as string,
    seen: r.seen as boolean,
  }));
}

export async function markMatchesSeen(userId: string): Promise<void> {
  await supabase
    .from("job_matches")
    .update({ seen: true })
    .eq("user_id", userId)
    .eq("seen", false);
}

export async function getUnseenMatchCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from("job_matches")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("seen", false);
  return count ?? 0;
}

export async function markOneMatchSeen(matchId: string): Promise<void> {
  await supabase.from("job_matches").update({ seen: true }).eq("id", matchId);
}

export async function clearAllMatches(userId: string): Promise<void> {
  await supabase.from("job_matches").delete().eq("user_id", userId);
}
