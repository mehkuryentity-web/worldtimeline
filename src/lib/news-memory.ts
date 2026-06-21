import { supabase } from "@/lib/supabase";

export async function fetchNewsMemory(limit = 50) {
  const { data, error } = await supabase
    .from("ai_briefings")
    .select("id, summary, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Briefing fetch error:", error);
    return [];
  }

  return data ?? [];
}
