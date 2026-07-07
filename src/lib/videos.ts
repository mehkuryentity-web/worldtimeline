export interface VideoListing {
  id: string;
  title: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string | null;
  categoryId: string;
  viewCount: number | null;
  publishedAt: string;
  embedUrl: string;
}

export interface VideoSourceStatus {
  source: string;
  label: string;
  lastSyncedAt: string | null;
  error: string | null;
}

export interface VideosFetchResult {
  videos: VideoListing[];
  sources: VideoSourceStatus[];
}

const GET_VIDEOS_URL =
  "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/get-videos";

/**
 * ---- DATA SOURCE SEAM ----
 * Mirrors jobs.ts's getJobs(): the get-videos edge function already merges
 * every cached video provider server-side (currently just YouTube) and
 * reports freshness per-source, so adding a 2nd/Nth video API later needs
 * no changes here or in the UI -- just one more entry in that sources[]
 * array on the backend.
 *
 * country is the app's country code (e.g. "NG", "AR", "GLOBAL") -- the
 * backend filters video_archive by region_code, blending all regions when
 * GLOBAL is requested or a region hasn't synced any videos yet.
 */
export async function getVideos(country: string): Promise<VideosFetchResult> {
  try {
    const res = await fetch(GET_VIDEOS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country }),
    });
    if (!res.ok) return { videos: [], sources: [] };
    const json = await res.json();
    return {
      videos: Array.isArray(json?.videos) ? json.videos : [],
      sources: Array.isArray(json?.sources) ? json.sources : [],
    };
  } catch {
    // Network hiccup reaching Supabase; the article feed still renders fine
    // without videos mixed in.
    return { videos: [], sources: [] };
  }
}

export function formatViewCount(count: number | null): string | null {
  if (count === null || count === undefined) return null;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} views`;
}
