import { supabase } from "@/integrations/supabase/client";

export interface EngagementCounts {
  interestedCount: number;
  viewCount: number;
  commentCount: number;
}

export interface JobComment {
  id: string;
  jobId: string;
  userId: string;
  parentId: string | null;
  content: string;
  createdAt: string;
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * ---- REUSABLE PATTERN NOTE ----
 * All engagement here is per-user via Supabase auth (auth.uid()), enforced
 * by RLS policies on job_comments / job_reactions / job_views / job_reports.
 * Counts are read from the job_engagement_counts view for efficiency across
 * a whole feed rather than per-card round trips.
 */

export async function getEngagementCounts(
  jobIds: string[]
): Promise<Record<string, EngagementCounts>> {
  if (jobIds.length === 0) return {};
  const { data, error } = await supabase
    .from("job_engagement_counts")
    .select("*")
    .in("job_id", jobIds);

  const map: Record<string, EngagementCounts> = {};
  if (!error && data) {
    for (const row of data as Record<string, unknown>[]) {
      map[row.job_id as string] = {
        interestedCount: (row.interested_count as number) ?? 0,
        viewCount: (row.view_count as number) ?? 0,
        commentCount: (row.comment_count as number) ?? 0,
      };
    }
  }
  return map;
}

export async function getMyReactions(
  jobIds: string[],
  userId: string
): Promise<Set<string>> {
  if (jobIds.length === 0) return new Set();
  const { data } = await supabase
    .from("job_reactions")
    .select("job_id")
    .eq("user_id", userId)
    .in("job_id", jobIds);
  return new Set((data ?? []).map((r: { job_id: string }) => r.job_id));
}

export async function toggleInterested(
  jobId: string,
  userId: string,
  currentlyInterested: boolean
): Promise<void> {
  if (currentlyInterested) {
    await supabase
      .from("job_reactions")
      .delete()
      .eq("job_id", jobId)
      .eq("user_id", userId);
  } else {
    await supabase
      .from("job_reactions")
      .upsert({ job_id: jobId, user_id: userId }, { onConflict: "job_id,user_id" });
  }
}

export async function recordView(jobId: string, userId: string): Promise<void> {
  await supabase
    .from("job_views")
    .upsert(
      { job_id: jobId, user_id: userId },
      { onConflict: "job_id,user_id", ignoreDuplicates: true }
    );
}

export async function getComments(jobId: string): Promise<JobComment[]> {
  const { data, error } = await supabase
    .from("job_comments")
    .select("id, job_id, user_id, parent_id, content, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((c) => ({
    id: c.id as string,
    jobId: c.job_id as string,
    userId: c.user_id as string,
    parentId: (c.parent_id as string) ?? null,
    content: c.content as string,
    createdAt: c.created_at as string,
  }));
}

export async function addComment(
  jobId: string,
  userId: string,
  content: string,
  parentId: string | null = null
): Promise<void> {
  await supabase
    .from("job_comments")
    .insert({ job_id: jobId, user_id: userId, content, parent_id: parentId });
}

export async function reportJob(
  jobId: string,
  userId: string,
  reason: string
): Promise<void> {
  await supabase.from("job_reports").insert({ job_id: jobId, user_id: userId, reason });
}
