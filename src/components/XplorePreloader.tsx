import { useEffect, useState } from 'react';

const SESSION_KEY = 'xplore_preloader_seen';
const DURATION_MS = 1500;

const TICKER_TEXTS = [
  'Scanning global opportunities...',
  'Matching jobs, scholarships & grants near you...',
  'Zeroing in on internships worldwide...',
];

const NODES = [
  { icon: 'briefcase', label: 'Jobs', pos: 'top' },
  { icon: 'school', label: 'Scholarships', pos: 'right' },
  { icon: 'certificate', label: 'Internships', pos: 'bottom' },
  { icon: 'coin', label: 'Grants', pos: 'left' },
] as const;

interface XplorePreloaderProps {
  children: React.ReactNode;
}

export function XplorePreloader({ children }: XplorePreloaderProps) {
  // If we've already shown it this session, skip straight to content.
  const [showPreloader, setShowPreloader] = useState(
    () => sessionStorage.getItem(SESSION_KEY) !== 'true'
  );
  const [tickerIndex, setTickerIndex] = useState(0);

  useEffect(() => {
    if (!showPreloader) return;

    const tickerInterval = setInterval(() => {
      setTickerIndex((i) => (i + 1) % TICKER_TEXTS.length);
    }, DURATION_MS / TICKER_TEXTS.length);

    const dismissTimer = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, 'true');
      setShowPreloader(false);
    }, DURATION_MS);

    return () => {
      clearInterval(tickerInterval);
      clearTimeout(dismissTimer);
    };
  }, [showPreloader]);

  if (!showPreloader) return <>{children}</>;

  return (
    <div className="xplore-preloader-root">
      <div className="xplore-preloader-radar">
        <div className="xplore-preloader-ring" />
        <div className="xplore-preloader-sweep" />
        {NODES.map((node, i) => (
          <div
            key={node.icon}
            className={`xplore-preloader-node xplore-preloader-node--${node.pos}`}
            style={{ animationDelay: `${i * (DURATION_MS / NODES.length)}ms` }}
          >
            <i className={`ti ti-${node.icon}`} aria-hidden="true" />
            <span>{node.label}</span>
          </div>
        ))}
      </div>
      <p className="xplore-preloader-ticker">{TICKER_TEXTS[tickerIndex]}</p>

      <style>{`
        .xplore-preloader-root {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
          gap: 20px;
        }
        .xplore-preloader-radar {
          position: relative;
          width: 160px;
          height: 160px;
        }
        .xplore-preloader-ring {
          position: absolute;
          inset: 20px;
          border-radius: 50%;
          border: 1px solid var(--border, #e5e5e5);
        }
        .xplore-preloader-sweep {
          position: absolute;
          inset: 20px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, rgba(59,130,246,0.35), transparent 35%);
          animation: xplore-spin 1.5s linear infinite;
        }
        @keyframes xplore-spin {
          to { transform: rotate(360deg); }
        }
        .xplore-preloader-node {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          width: 56px;
          font-size: 10px;
          color: #9a9a9a;
          animation: xplore-flash 1.5s linear infinite;
        }
        .xplore-preloader-node i {
          font-size: 18px;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fff;
          border: 1px solid #e5e5e5;
        }
        @keyframes xplore-flash {
          0%, 82%, 100% { color: #9a9a9a; }
          4% { color: #3b82f6; }
        }
        .xplore-preloader-node--top { top: 0; left: 50%; transform: translateX(-50%); align-items: center; }
        .xplore-preloader-node--right { right: -8px; top: 50%; transform: translateY(-50%); }
        .xplore-preloader-node--bottom { bottom: 0; left: 50%; transform: translateX(-50%); }
        .xplore-preloader-node--left { left: -8px; top: 50%; transform: translateY(-50%); }
        .xplore-preloader-ticker {
          font-size: 13px;
          color: var(--text-secondary, #666);
          margin: 0;
        }
      `}</style>
    </div>
  );
}
