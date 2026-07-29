import { useQuery } from "@tanstack/react-query";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Below this many articles in the last 7 days, a country is flagged as
// "low coverage" in the selector — it'll still show real news, just thin.
export const LOW_COVERAGE_THRESHOLD = 50;

async function fetchCountryCoverage(): Promise<Record<string, number>> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-country-coverage`);
  const json = await res.json();
  if (!json.ok) throw new Error("country coverage fetch failed");
  return json.counts as Record<string, number>;
}

/**
 * Live per-country article counts (7-day window) for flagging thin
 * coverage in the CountrySelector. Backed by get-country-coverage,
 * which caches server-side for 6h.
 */
export function useCountryCoverage() {
  return useQuery({
    queryKey: ["country-coverage"],
    queryFn: fetchCountryCoverage,
    staleTime: 3 * 60 * 60 * 1000, // 3h
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
