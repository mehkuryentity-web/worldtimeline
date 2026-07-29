import { useQuery } from "@tanstack/react-query";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface AppStats {
  countries: number;
  sources: number;
}

async function fetchAppStats(): Promise<AppStats> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-app-stats`);
  const json = await res.json();
  if (!json.ok) throw new Error("app stats fetch failed");
  return { countries: json.countries, sources: json.sources };
}

/**
 * Live "Monitoring X Countries • Y Sources" numbers for the footer.
 * Backed by get-app-stats, which itself caches in api_cache for 12h —
 * this hook just adds a long client-side staleTime on top so the app
 * isn't re-fetching this on every mount.
 */
export function useAppStats() {
  return useQuery({
    queryKey: ["app-stats"],
    queryFn: fetchAppStats,
    staleTime: 6 * 60 * 60 * 1000, // 6h
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}
