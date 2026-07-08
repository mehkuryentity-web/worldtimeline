import { useState } from "react";
import { Play, Eye, Clock, Sparkles } from "lucide-react";
import type { VideoListing } from "@/lib/videos";
import { formatViewCount } from "@/lib/videos";
import { timeAgo } from "@/lib/format";
import { getVideoBrief, type VideoBrief } from "@/lib/video-brief";
import { VideoReactionBar } from "./VideoReactionBar";

interface Props {
  video: VideoListing;
}

export function VideoCard({ video }: Props) {
  const [playing, setPlaying] = useState(false);
  const [brief, setBrief] = useState<VideoBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefRequested, setBriefRequested] = useState(false);
  const viewLabel = formatViewCount(video.viewCount);

  // Full native YouTube controls (default controls=1) -- play/pause, seek
  // bar, volume, fullscreen, captions, all included. Only rel=0 and
  // modestbranding=1 are set, to keep related-video suggestions and the
  // YouTube logo from cluttering the card.
  const embedSrc = `${video.embedUrl}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  // Brief only fetches on a real signal of intent -- tapping play -- not on
  // every card render. Scrolling past a card doesn't trigger a Groq call;
  // only actually wanting to watch it does. Still cached server-side after
  // the first request for a given video, regardless of who triggers it.
  const handlePlay = () => {
    setPlaying(true);

    if (briefRequested) return;
    setBriefRequested(true);
    setBriefLoading(true);

    getVideoBrief({
      videoId: video.id,
      title: video.title,
      description: video.description,
      channelTitle: video.channelTitle,
    }).then((result) => {
      setBrief(result);
      setBriefLoading(false);
    });
  };

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
            src={embedSrc}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <button
            onClick={handlePlay}
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

        {/* AI brief -- only requested once the user taps play (see
            handlePlay above). Title dynamically chosen server-side from a
            small, extensible option set (see video-brief edge function).
            Grounded only in title/description/channel data actually
            returned by the YouTube API; never invents specifics. */}
        {briefLoading ? (
          <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-surface-2" />
        ) : brief ? (
          <div className="mt-2 rounded-lg border border-border bg-surface-2/60 px-3 py-2">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" />
              {brief.title}
            </div>
            <p className="mt-1 text-[13px] leading-snug text-foreground/90">
              {brief.brief}
            </p>
          </div>
        ) : null}

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

      <VideoReactionBar video={video} />
    </article>
  );
}
