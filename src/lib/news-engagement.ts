import { supabase } from "@/integrations/supabase/client";

export interface NewsComment {
  id: string;
  articleId: string;
  userId: string;
  parentId: string | null;
  content: string;
  createdAt: string;
}

/**
 * ---- REUSABLE PATTERN NOTE ----
 * Mirrors src/lib/job-engagement.ts. All engagement is per-user via
 * Supabase auth (auth.uid()), enforced by RLS policies on
 * news_comments / news_comment_likes. Bulk counts are read from the
 * news_comment_counts view for efficient reads across a whole feed
 * rather than per-card round trips (same reasoning as
 * job_engagement_counts).
 */

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function getCommentCount(articleId: string): Promise<number> {
  const { count } = await supabase
    .from("news_comments")
    .select("id", { count: "exact", head: true })
    .eq("article_id", articleId);
  return count ?? 0;
}

// Bulk variant for feed views that render many articles at once --
// avoids one round trip per card, same as getEngagementCounts() for jobs.
export async function getCommentCounts(
  articleIds: string[]
): Promise<Record<string, number>> {
  if (articleIds.length === 0) return {};
  const { data, error } = await supabase
    .from("news_comment_counts")
    .select("*")
    .in("article_id", articleIds);

  const map: Record<string, number> = {};
  if (!error && data) {
    for (const row of data as Record<string, unknown>[]) {
      map[row.article_id as string] = (row.comment_count as number) ?? 0;
    }
  }
  return map;
}

export async function getComments(articleId: string): Promise<NewsComment[]> {
  const { data, error } = await supabase
    .from("news_comments")
    .select("id, article_id, user_id, parent_id, content, created_at")
    .eq("article_id", articleId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((c) => ({
    id: c.id as string,
    articleId: c.article_id as string,
    userId: c.user_id as string,
    parentId: (c.parent_id as string) ?? null,
    content: c.content as string,
    createdAt: c.created_at as string,
  }));
}

export async function addComment(
  articleId: string,
  userId: string,
  content: string,
  parentId: string | null = null
): Promise<void> {
  await supabase
    .from("news_comments")
    .insert({ article_id: articleId, user_id: userId, content, parent_id: parentId });
}
