// Loading placeholder shaped like a real NewsCard -- same wrapper, image
// block, header row, title/summary lines, and source row -- so the feed's
// loading state reads as "content is about to appear here" instead of a
// blank screen with a spinner off to one side. Every block pulses using the
// app's primary color (not a neutral gray) so the loading state still feels
// on-brand rather than generic.
//
// Used for every feed load (first load AND every country/category switch),
// not just the very first load of a session -- previously only the first
// load got a real preloader (TelemetryPreloader) and every switch after
// that fell back to a bare spinner with nothing else on screen.

interface Props {
  /** Stagger this card's pulse slightly so a row of skeletons doesn't all
   *  flash in perfect unison -- reads as more alive, matches the staggered
   *  timing already used by ArticleSummaryPreloader/JobsPreloader elsewhere
   *  in the app. */
  delayMs?: number;
}

export function NewsCardSkeleton({ delayMs = 0 }: Props) {
  const pulse = "animate-pulse bg-primary/15";
  const style = { animationDelay: `${delayMs}ms` };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
      {/* header row: category + clock */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className={`h-2.5 w-14 rounded ${pulse}`} style={style} />
        <div className={`h-2.5 w-10 rounded ${pulse}`} style={style} />
      </div>

      {/* image block */}
      <div className="aspect-[16/9] w-full bg-surface-2">
        <div className={`h-full w-full ${pulse}`} style={style} />
      </div>

      {/* title + summary + source */}
      <div className="px-4 py-3">
        <div className={`h-4 w-11/12 rounded ${pulse}`} style={style} />
        <div
          className={`mt-2 h-4 w-3/4 rounded ${pulse}`}
          style={{ animationDelay: `${delayMs + 80}ms` }}
        />

        <div
          className={`mt-3 h-3 w-full rounded ${pulse}`}
          style={{ animationDelay: `${delayMs + 160}ms` }}
        />
        <div
          className={`mt-1.5 h-3 w-5/6 rounded ${pulse}`}
          style={{ animationDelay: `${delayMs + 240}ms` }}
        />

        <div className="mt-3 flex items-center gap-2">
          <div
            className={`h-2.5 w-16 rounded ${pulse}`}
            style={{ animationDelay: `${delayMs + 320}ms` }}
          />
          <div
            className={`h-2.5 w-10 rounded ${pulse}`}
            style={{ animationDelay: `${delayMs + 320}ms` }}
          />
        </div>
      </div>
    </div>
  );
}

// Renders a stack of skeleton cards for a feed's loading state, each
// staggered a bit further so the flash cascades down the list rather than
// blinking in lockstep.
export function NewsFeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <NewsCardSkeleton key={i} delayMs={i * 100} />
      ))}
    </div>
  );
}
