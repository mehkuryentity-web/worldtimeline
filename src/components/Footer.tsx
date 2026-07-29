import React from "react";
import { useAppStats } from "@/hooks/use-app-stats";

interface FooterProps {
  appVersion?: string;
  isBeta?: boolean;
  authorName?: string;
}

/**
 * App footer — shown at the bottom of the Profile page.
 *
 * Line 1: © {year} WorldTimeline by {author}
 * Line 2: Beta badge + version
 * Line 3: live coverage stats, pulled from get-app-stats
 */
export function Footer({
  appVersion = "1.0.0",
  isBeta = true,
  authorName = "ME",
}: FooterProps) {
  const year = new Date().getFullYear();
  const { data: stats, isLoading } = useAppStats();

  return (
    <footer className="w-full py-6 px-4 text-center border-t border-white/10">
      <div className="flex flex-col items-center gap-1.5 text-xs text-white/40">
        <p>
          © {year} WorldTimeline by {authorName}
        </p>

        <p className="flex items-center gap-1.5">
          {isBeta && (
            <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 text-[10px] font-medium tracking-wide uppercase">
              Beta
            </span>
          )}
          <span>v{appVersion}</span>
        </p>

        <p className="text-white/30">
          {isLoading || !stats ? (
            "Monitoring global news sources"
          ) : (
            <>
              Monitoring {stats.countries.toLocaleString()} Countries •{" "}
              {stats.sources.toLocaleString()} Sources
            </>
          )}
        </p>
      </div>
    </footer>
  );
}
