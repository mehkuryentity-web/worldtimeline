import { useEffect, useRef, useState } from "react";

// High-Speed News Telemetry Core Preloader — shown on the very first feed
// load (in place of the old "Loading feed..." spinner + blank space).
//
// The message sequence advances every 800ms and HOLDS on the last message
// if the real feed request takes longer than the ~4s the sequence covers —
// it never loops back to message 1, and it never shows anything the app
// wasn't actually told to show. The component itself doesn't decide when
// to disappear: the parent unmounts it the moment real data arrives (see
// usage in index.tsx), so it's tied to actual load state, not a timer.

const MESSAGES = [
  "Connecting to Relays...",
  "Scraping Local Networks...",
  "Aggregating Global Feeds...",
  "Downlinking Live Streams...",
  "Compiling Bulletins...",
] as const;

const STEP_MS = 800;
const MATRIX_CHARS = "アイウエオカキクケコサシスセソ01アイウ日月火水木金土01".split("");
const COLS = 7;
const LINES_PER_COL = 22;

function randChar() {
  return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
}

export function TelemetryPreloader() {
  const [msgIndex, setMsgIndex] = useState(0);
  const cascadeRef = useRef<HTMLDivElement>(null);

  // message cycle — advances every 800ms, holds on the final message
  useEffect(() => {
    if (msgIndex >= MESSAGES.length - 1) return;
    const t = setTimeout(() => setMsgIndex((i) => i + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [msgIndex]);

  // matrix cascade columns — built once, then flickered in place
  useEffect(() => {
    const el = cascadeRef.current;
    if (!el) return;

    el.innerHTML = "";
    for (let c = 0; c < COLS; c++) {
      const col = document.createElement("div");
      col.className = "wt-tp-col";
      const cyan = c % 2 === 0;
      col.style.color = cyan
        ? `oklch(0.82 0.18 195 / ${(0.35 + Math.random() * 0.5).toFixed(2)})`
        : `oklch(0.96 0.005 240 / ${(0.35 + Math.random() * 0.5).toFixed(2)})`;
      col.style.animationDuration = `${(1.1 + Math.random() * 1.4).toFixed(2)}s`;
      col.style.animationDelay = `${(Math.random() * -2).toFixed(2)}s`;

      let html = "";
      for (let i = 0; i < LINES_PER_COL; i++) html += `<span>${randChar()}</span>`;
      col.innerHTML = html + html; // duplicated for a seamless loop
      el.appendChild(col);
    }

    const flicker = setInterval(() => {
      const spans = el.querySelectorAll("span");
      for (let i = 0; i < 6; i++) {
        const span = spans[Math.floor(Math.random() * spans.length)];
        if (span) span.textContent = randChar();
      }
    }, 120);

    return () => clearInterval(flicker);
  }, []);

  return (
    <div className="wt-tp-stage" role="status" aria-live="polite">
      <style>{TELEMETRY_STYLES}</style>

      <div className="wt-tp-core-wrap">
        <div className="wt-tp-ring wt-tp-ring--tick" />
        <div className="wt-tp-ring wt-tp-ring--outer" />
        <div className="wt-tp-ring wt-tp-ring--inner" />
        <div className="wt-tp-core">
          <div className="wt-tp-pulse" />
          <div className="wt-tp-cascade" ref={cascadeRef} />
        </div>
      </div>

      <div className="wt-tp-console">
        <div className="wt-tp-console-head">
          <span className="wt-tp-label">Telemetry Core // Status</span>
          <span className="wt-tp-dot" />
        </div>
        <div className="wt-tp-console-body">
          <span className="wt-tp-prefix">&gt;</span>
          <span className="wt-tp-msg">{MESSAGES[msgIndex]}</span>
          <span className="wt-tp-cursor" />
        </div>
      </div>

      <span className="sr-only">Loading news feed</span>
    </div>
  );
}

const TELEMETRY_STYLES = `
  .wt-tp-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
    position: relative;
    padding: 40px 16px;
    font-family: var(--font-mono, ui-monospace, monospace);
  }

  .wt-tp-core-wrap {
    position: relative;
    width: 148px;
    height: 148px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .wt-tp-ring { position: absolute; border-radius: 50%; border-style: dashed; border-color: transparent; }

  .wt-tp-ring--outer {
    width: 148px; height: 148px; border-width: 1.5px;
    border-top-color: oklch(0.82 0.18 195);
    border-right-color: oklch(0.82 0.18 195);
    border-bottom-color: oklch(0.82 0.18 195 / 0.25);
    border-left-color: oklch(0.82 0.18 195 / 0.25);
    animation: wt-tp-spin 7s linear infinite;
    filter: drop-shadow(0 0 6px oklch(0.82 0.18 195 / 0.35));
  }

  .wt-tp-ring--inner {
    width: 112px; height: 112px; border-width: 1.5px;
    border-top-color: oklch(0.78 0.17 75);
    border-left-color: oklch(0.78 0.17 75);
    border-bottom-color: oklch(0.78 0.17 75 / 0.2);
    border-right-color: oklch(0.78 0.17 75 / 0.2);
    animation: wt-tp-spin-reverse 5s linear infinite;
    filter: drop-shadow(0 0 5px oklch(0.78 0.17 75 / 0.3));
  }

  .wt-tp-ring--tick {
    width: 132px; height: 132px; border-width: 1px; border-style: dotted;
    border-color: oklch(0.96 0.005 240 / 0.12);
    animation: wt-tp-spin 14s linear infinite;
  }

  @keyframes wt-tp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes wt-tp-spin-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }

  .wt-tp-core {
    position: relative; width: 86px; height: 86px; border-radius: 50%; overflow: hidden;
    background: radial-gradient(circle at 50% 40%, oklch(0.22 0.03 195), var(--color-surface-1, oklch(0.18 0.012 240)) 75%);
    box-shadow: 0 0 20px oklch(0.82 0.18 195 / 0.45), 0 0 55px oklch(0.82 0.18 195 / 0.16), inset 0 0 18px oklch(0 0 0 / 0.6);
    display: flex;
  }

  .wt-tp-pulse {
    position: absolute; inset: 0; border-radius: 50%;
    box-shadow: 0 0 0 0 oklch(0.82 0.18 195 / 0.55);
    animation: wt-tp-pulse 2.2s ease-out infinite;
    z-index: 2;
  }

  @keyframes wt-tp-pulse {
    0% { box-shadow: 0 0 0 0 oklch(0.82 0.18 195 / 0.55); }
    70% { box-shadow: 0 0 0 14px oklch(0.82 0.18 195 / 0); }
    100% { box-shadow: 0 0 0 0 oklch(0.82 0.18 195 / 0); }
  }

  .wt-tp-cascade { position: absolute; inset: 0; display: flex; justify-content: space-evenly; z-index: 1; }
  .wt-tp-cascade .wt-tp-col { display: flex; flex-direction: column; animation: wt-tp-fall linear infinite; font-size: 9px; line-height: 11px; white-space: pre; text-shadow: 0 0 5px currentColor; }
  @keyframes wt-tp-fall { from { transform: translateY(-50%); } to { transform: translateY(0%); } }

  .wt-tp-console {
    width: min(320px, 88vw);
    border: 1px solid var(--color-border, oklch(0.28 0.014 240));
    background: oklch(0.18 0.012 240 / 0.85);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 0 24px oklch(0 0 0 / 0.35);
  }

  .wt-tp-console-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 7px 11px; border-bottom: 1px solid var(--color-border, oklch(0.28 0.014 240));
    background: var(--color-surface-2, oklch(0.22 0.014 240));
  }

  .wt-tp-label { font-size: 10px; letter-spacing: 0.16em; color: var(--color-muted-foreground, oklch(0.65 0.02 240)); text-transform: uppercase; }

  .wt-tp-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: oklch(0.72 0.22 145);
    box-shadow: 0 0 6px oklch(0.72 0.22 145);
    animation: wt-tp-blink-dot 1.4s ease-in-out infinite;
  }
  @keyframes wt-tp-blink-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

  .wt-tp-console-body { padding: 12px 11px; min-height: 18px; font-size: 12px; color: oklch(0.82 0.18 195); display: flex; align-items: baseline; gap: 2px; }
  .wt-tp-prefix { color: var(--color-muted-foreground, oklch(0.65 0.02 240)); margin-right: 6px; }

  .wt-tp-cursor {
    display: inline-block; width: 6px; height: 12px; margin-left: 4px;
    background: oklch(0.82 0.18 195);
    animation: wt-tp-caret 1s steps(1) infinite;
    transform: translateY(1px);
  }
  @keyframes wt-tp-caret { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }

  @media (prefers-reduced-motion: reduce) {
    .wt-tp-ring--outer, .wt-tp-ring--inner, .wt-tp-ring--tick, .wt-tp-pulse, .wt-tp-cursor, .wt-tp-dot {
      animation: none !important;
    }
  }
`;
