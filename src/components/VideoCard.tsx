import { useState } from "react";
import { Play, Eye, Clock } from "lucide-react";
import type { VideoListing } from "@/lib/videos";
import { formatViewCount } from "@/lib/videos";
import { timeAgo } from "@/lib/format";

interface Props {
  video: VideoListing;
}

export function VideoCard({ video }: Props) {
  const [playing, setPlaying] = useState(false);
  const viewLabel = formatViewCount(video.viewCount);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface-1">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Video · News
        </span>
        <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {timeAgo(video.publishedAt)}
        </span>
      </div>

      <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
        {playing ? (
          // Iframe only mounts once tapped -- mixing videos into a feed of
          // dozens of cards should never mean dozens of iframes loading at
          // once (same connection-pool lesson learned from the Jobs feed).
          <iframe
            src={`${video.embedUrl}?autoplay=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="group relative block h-full w-full"
            aria-label={`Play ${video.title}`}
          >
            {video.thumbnailUrl && (
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/30">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition group-hover:scale-105">
                <Play className="h-5 w-5 translate-x-[1px] fill-black text-black" />
              </span>
            </span>
          </button>
        )}
      </div>

      <div className="px-4 py-3">
        <h3 className="text-[16px] font-semibold leading-snug tracking-tight">
          {video.title}
        </h3>
        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="text-foreground/80">{video.channelTitle}</span>
          {viewLabel && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 normal-case tracking-normal">
                <Eye className="h-3 w-3" />
                {viewLabel}
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
