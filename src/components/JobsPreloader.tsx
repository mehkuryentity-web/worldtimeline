export function JobsPreloader() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-10"
      role="status"
      aria-label="Loading jobs"
    >
      <style>{`
        @keyframes wt-loupe-sweep {
          0%   { transform: translate(-16px, -6px) rotate(-8deg); }
          25%  { transform: translate(14px, -14px) rotate(3deg); }
          48%  { transform: translate(6px, 16px) rotate(8deg); }
          58%  { transform: translate(4px, 14px) rotate(6deg); }
          75%  { transform: translate(-10px, -8px) rotate(-4deg); }
          100% { transform: translate(-16px, -6px) rotate(-8deg); }
        }
        @keyframes wt-star-pop {
          0%, 40%   { transform: translateY(10px) scale(0); opacity: 0; }
          50%       { transform: translateY(-6px) scale(1.2); opacity: 1; }
          58%       { transform: translateY(-2px) scale(0.95); opacity: 1; }
          70%, 100% { transform: translateY(10px) scale(0); opacity: 0; }
        }
        @keyframes wt-star-twinkle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes wt-papers-breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }
        .wt-loupe-group {
          animation: wt-loupe-sweep 3.4s ease-in-out infinite;
          transform-origin: 58px 46px;
        }
        .wt-star-group {
          animation: wt-star-pop 3.4s ease-in-out infinite;
          transform-origin: 69px 85px;
        }
        .wt-star-shape {
          animation: wt-star-twinkle 0.9s ease-in-out infinite;
          transform-origin: 69px 85px;
        }
        .wt-papers {
          animation: wt-papers-breathe 3.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .wt-loupe-group, .wt-star-group, .wt-star-shape, .wt-papers {
            animation: none;
          }
          .wt-star-group {
            opacity: 1;
            transform: translateY(-6px) scale(1);
          }
        }
      `}</style>

      <svg
        width="140"
        height="120"
        viewBox="0 0 140 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Paper stack */}
        <g className="wt-papers">
          <rect
            x="26" y="60" width="70" height="46" rx="4"
            className="fill-surface-2 stroke-border"
            strokeWidth="1"
            transform="rotate(-7 61 83)"
          />
          <rect
            x="32" y="58" width="70" height="46" rx="4"
            className="fill-surface-2 stroke-border"
            strokeWidth="1"
            transform="rotate(4 67 81)"
          />
          <rect
            x="29" y="56" width="70" height="46" rx="4"
            className="fill-surface-1 stroke-border"
            strokeWidth="1.5"
            transform="rotate(-2 64 79)"
          />
          {/* subtle lines to read as "papers" */}
          <line x1="40" y1="70" x2="80" y2="70" className="stroke-border" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          <line x1="40" y1="77" x2="72" y2="77" className="stroke-border" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        </g>

        {/* Hidden star -- pops up from the stack, then tucks back in */}
        <g className="wt-star-group">
          <path
            className="wt-star-shape fill-accent"
            d="M69,75 L71.12,81.09 L77.56,81.22 L72.42,85.11 L74.29,91.28 L69,87.6 L63.71,91.28 L65.58,85.11 L60.44,81.22 L66.88,81.09 Z"
          />
        </g>

        {/* Magnifying glass, sweeping over the stack */}
        <g className="wt-loupe-group">
          <circle
            cx="58" cy="46" r="17"
            className="fill-surface-1 stroke-primary"
            strokeWidth="4"
            fillOpacity="0.55"
          />
          <line
            x1="70" y1="58" x2="84" y2="72"
            className="stroke-primary"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>
      </svg>

      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Digging up the latest roles…
      </p>
    </div>
  );
}
