import { supabase } from "@/lib/supabase";

export async function fetchNewsMemory(limit = 50) {
  const { data, error } = await supabase
    .from("news_items")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Memory fetch error:", error);
    return [];
  }

  return data ?? [];
}
