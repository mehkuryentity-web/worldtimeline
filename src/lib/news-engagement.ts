import { supabase } from "@/integrations/supabase/client";

export interface NewsComment {
  id: string;
  articleId: string;
  userId: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
  likeCount: number;
  likedByMe: boolean;
}

/**
 * ---- REUSABLE PATTERN NOTE ----
 * This is the template for threaded comments with author identity and
 * likes -- intended to be reused by Xplore's job/scholarship/grant/
 * internship tabs next, replacing their current name-and-avatar-less,
 * unwired-likes state.
 *
 * All engagement is per-user via Supabase auth (auth.uid()), enforced by
 * RLS on news_comments / news_comment_likes / profiles. Author info and
 * like counts are batch-fetched (2 extra queries total, not per-comment)
 * to avoid N+1 round trips.
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
// avoids one round trip per card.
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

export async function getComments(
  articleId: string,
  currentUserId: string | null
): Promise<NewsComment[]> {
  const { data: rows, error } = await supabase
    .from("news_comments")
    .select("id, article_id, user_id, parent_id, content, created_at")
    .eq("article_id", articleId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load news comments", error);
    return [];
  }
  if (!rows || rows.length === 0) return [];

  const commentIds = rows.map((r) => r.id as string);
  const userIds = [...new Set(rows.map((r) => r.user_id as string))];

  const [{ data: profiles, error: profilesError }, { data: likes, error: likesError }] =
    await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds),
      supabase.from("news_comment_likes").select("comment_id, user_id").in("comment_id", commentIds),
    ]);

  if (profilesError) console.error("Failed to load commenter profiles", profilesError);
  if (likesError) console.error("Failed to load comment likes", likesError);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id as string, p as { display_name: string | null; avatar_url: string | null }])
  );
  const likeCounts = new Map<string, number>();
  const likedByMeSet = new Set<string>();
  for (const l of (likes ?? []) as { comment_id: string; user_id: string }[]) {
    likeCounts.set(l.comment_id, (likeCounts.get(l.comment_id) ?? 0) + 1);
    if (currentUserId && l.user_id === currentUserId) likedByMeSet.add(l.comment_id);
  }

  return (rows as Record<string, unknown>[]).map((c) => {
    const profile = profileMap.get(c.user_id as string);
    return {
      id: c.id as string,
      articleId: c.article_id as string,
      userId: c.user_id as string,
      parentId: (c.parent_id as string) ?? null,
      content: c.content as string,
      createdAt: c.created_at as string,
      authorName: profile?.display_name || "Anonymous",
      authorAvatarUrl: profile?.avatar_url ?? null,
      likeCount: likeCounts.get(c.id as string) ?? 0,
      likedByMe: likedByMeSet.has(c.id as string),
    };
  });
}

export async function addComment(
  articleId: string,
  userId: string,
  content: string,
  parentId: string | null = null
): Promise<void> {
  const { error } = await supabase
    .from("news_comments")
    .insert({ article_id: articleId, user_id: userId, content, parent_id: parentId });
  if (error) {
    console.error("Failed to post news comment", error);
    throw error;
  }
}

export async function toggleCommentLike(
  commentId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<void> {
  if (currentlyLiked) {
    const { error } = await supabase
      .from("news_comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", userId);
    if (error) {
      console.error("Failed to unlike comment", error);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("news_comment_likes")
      .upsert({ comment_id: commentId, user_id: userId }, { onConflict: "comment_id,user_id" });
    if (error) {
      console.error("Failed to like comment", error);
      throw error;
    }
  }
}
