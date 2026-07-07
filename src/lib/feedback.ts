import { supabase } from "@/integrations/supabase/client";

export type FeedbackCategory = "bug" | "idea" | "other";

interface SubmitFeedbackInput {
  category: FeedbackCategory;
  message: string;
  email?: string | null;
  userId?: string | null;
}

/**
 * Write-only from the client -- the feedback table has an INSERT policy
 * but no SELECT policy for anon/authenticated, so this never reads back
 * what was submitted. Mirrors the direct-insert pattern already used for
 * job comments/reports in job-engagement.ts.
 */
export async function submitFeedback(input: SubmitFeedbackInput): Promise<void> {
  const { error } = await supabase.from("feedback").insert({
    category: input.category,
    message: input.message.trim(),
    email: input.email || null,
    user_id: input.userId || null,
  });

  if (error) {
    throw new Error(error.message || "Failed to submit feedback");
  }
}
