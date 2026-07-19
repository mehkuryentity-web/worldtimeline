import { useId, useMemo } from "react";
import { rngFor, between } from "@/lib/cover-art";
import type { Category } from "@/lib/mock-news";

interface Props {
  title: string;
  category: string;
  className?: string;
}

interface Theme {
  label: string;
  base: string; // deep background wash, near-black, category-tinted
  accent: string; // primary glow / motif color
  accent2: string; // secondary glow color, for gradient depth
  motif: (rng: () => number, accent: string, accent2: string) => string; // returns inner SVG markup
}

const W = 400;
const H = 225;

// ---- motif generators -----------------------------------------------
// Each returns raw SVG markup (kept as strings, not JSX, so the whole
// cover can be memoized as one static blob per title+category and
// dangerouslySet once -- cheap, and avoids re-creating dozens of React
// elements per card on every parent re-render).

function circuits(rng: () => number, accent: string): string {
  // Snap nodes to an invisible grid so traces read as right-angled
  // circuit paths rather than random scribbles.
  const cols = 7;
  const rows = 4;
  const cellW = W / cols;
  const cellH = H / rows;
  const nodeCount = 6;
  const pts: [number, number][] = [];
  for (let i = 0; i < nodeCount; i++) {
    const gx = Math.floor(between(rng, 1, cols - 1));
    const gy = Math.floor(between(rng, 0, rows));
    pts.push([gx * cellW, gy * cellH]);
  }
  let paths = "";
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    // L-shaped trace: horizontal then vertical
    paths += `<path d="M${x1},${y1} L${x2},${y1} L${x2},${y2}" stroke="${accent}" stroke-width="1.5" fill="none" opacity="0.55" filter="url(#glow)"/>`;
  }
  let nodes = "";
  pts.forEach(([x, y], i) => {
    const hollow = i % 2 === 0;
    nodes += hollow
      ? `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.85"/>`
      : `<circle cx="${x}" cy="${y}" r="3" fill="${accent}" opacity="0.9"/>`;
  });
  return paths + nodes;
}

function molecules(rng: () => number, accent: string, accent2: string): string {
  const atoms: [number, number, number][] = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    atoms.push([between(rng, 60, W - 60), between(rng, 40, H - 40), between(rng, 4, 9)]);
  }
  let bonds = "";
  for (let i = 0; i < atoms.length - 1; i++) {
    bonds += `<line x1="${atoms[i][0]}" y1="${atoms[i][1]}" x2="${atoms[i + 1][0]}" y2="${atoms[i + 1][1]}" stroke="${accent}" stroke-width="1" opacity="0.4"/>`;
  }
  // one extra cross-bond for a less linear feel
  bonds += `<line x1="${atoms[0][0]}" y1="${atoms[0][1]}" x2="${atoms[3][0]}" y2="${atoms[3][1]}" stroke="${accent}" stroke-width="1" opacity="0.3"/>`;
  const nodes = atoms
    .map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 2 ? accent2 : accent}" opacity="0.8" filter="url(#glow)"/>`)
    .join("");
  return bonds + nodes;
}

function chart(rng: () => number, accent: string, accent2: string): string {
  const bars = 6;
  const gap = 14;
  const barW = 22;
  const totalW = bars * barW + (bars - 1) * gap;
  const startX = (W - totalW) / 2;
  const baseY = H - 40;
  let bars_ = "";
  let points: [number, number][] = [];
  for (let i = 0; i < bars; i++) {
    const trend = (i / bars) * 60;
    const h = 25 + trend + between(rng, -10, 15);
    const x = startX + i * (barW + gap);
    bars_ += `<rect x="${x}" y="${baseY - h}" width="${barW}" height="${h}" rx="3" fill="${accent}" opacity="${0.18 + i * 0.08}"/>`;
    points.push([x + barW / 2, baseY - h - 10]);
  }
  const line = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const dots = points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="${accent2}"/>`).join("");
  return bars_ + `<path d="${line}" stroke="${accent2}" stroke-width="1.5" fill="none" opacity="0.8" filter="url(#glow)"/>` + dots;
}

function motion(rng: () => number, accent: string, accent2: string): string {
  let streaks = "";
  const n = 6;
  for (let i = 0; i < n; i++) {
    const y = between(rng, 20, H - 20);
    const len = between(rng, 60, 160);
    const x = between(rng, -20, W - 40);
    const thick = between(rng, 1, 3.5);
    const angle = -26;
    const rad = (angle * Math.PI) / 180;
    const x2 = x + len * Math.cos(rad);
    const y2 = y + len * Math.sin(rad);
    streaks += `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${i % 2 ? accent2 : accent}" stroke-width="${thick}" stroke-linecap="round" opacity="${between(rng, 0.25, 0.6)}"/>`;
  }
  return streaks;
}

function pulse(rng: () => number, accent: string): string {
  const midY = H / 2;
  const segments = 5;
  const segW = W / segments;
  let d = `M0,${midY}`;
  let peakX = 0;
  let peakY = midY;
  for (let i = 0; i < segments; i++) {
    const x0 = i * segW;
    if (i === Math.floor(segments / 2)) {
      const spikeX = x0 + segW * 0.3;
      const dipX = x0 + segW * 0.45;
      const topX = x0 + segW * 0.6;
      peakX = topX;
      peakY = midY - between(rng, 45, 65);
      d += ` L${x0 + segW * 0.15},${midY} L${spikeX},${midY + 12} L${dipX},${peakY} L${topX},${midY + 20} L${x0 + segW * 0.8},${midY}`;
    } else {
      d += ` L${x0 + segW},${midY + between(rng, -3, 3)}`;
    }
  }
  const dot = `<circle cx="${peakX}" cy="${peakY}" r="4" fill="${accent}" class="cover-pulse-dot" filter="url(#glow)"/>`;
  return `<path d="${d}" stroke="${accent}" stroke-width="1.75" fill="none" opacity="0.75" filter="url(#glow)"/>${dot}`;
}

function globe(rng: () => number, accent: string, accent2: string): string {
  const cx = W / 2;
  const cy = H / 2;
  const r = 62;
  let arcs = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${accent}" stroke-width="1.25" opacity="0.55"/>`;
  const latitudes = [0.35, 0.62, 0.85];
  latitudes.forEach((f) => {
    const ry = r * f;
    arcs += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${ry}" fill="none" stroke="${accent}" stroke-width="1" opacity="0.3"/>`;
  });
  arcs += `<line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}" stroke="${accent}" stroke-width="1" opacity="0.3"/>`;
  let dots = "";
  const cityCount = 4;
  for (let i = 0; i < cityCount; i++) {
    const theta = between(rng, 0, Math.PI * 2);
    const rr = between(rng, r * 0.5, r * 0.98);
    const x = cx + rr * Math.cos(theta);
    const y = cy + rr * Math.sin(theta) * 0.9;
    dots += `<circle cx="${x}" cy="${y}" r="2.5" fill="${accent2}" opacity="0.9" filter="url(#glow)"/>`;
  }
  return arcs + dots;
}

function geometric(rng: () => number, accent: string, accent2: string): string {
  const cx = between(rng, W * 0.35, W * 0.65);
  const cy = between(rng, H * 0.35, H * 0.65);
  let lines = "";
  const n = 6;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + between(rng, -0.2, 0.2);
    const len = between(rng, 90, 170);
    const x1 = cx - Math.cos(angle) * len * 0.5;
    const y1 = cy - Math.sin(angle) * len * 0.5;
    const x2 = cx + Math.cos(angle) * len * 0.5;
    const y2 = cy + Math.sin(angle) * len * 0.5;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${i % 2 ? accent2 : accent}" stroke-width="1.25" opacity="0.4"/>`;
  }
  lines += `<circle cx="${cx}" cy="${cy}" r="3" fill="${accent}" filter="url(#glow)"/>`;
  return lines;
}

function atmosphere(rng: () => number, accent: string, accent2: string): string {
  let waves = "";
  const n = 3;
  for (let i = 0; i < n; i++) {
    const y = 50 + i * 55 + between(rng, -10, 10);
    const amp = between(rng, 12, 26);
    const phase = between(rng, 0, 60);
    const d = `M-10,${y} C${W * 0.25 + phase},${y - amp} ${W * 0.4 - phase},${y + amp} ${W * 0.65},${y} S${W * 0.9},${y - amp} ${W + 10},${y}`;
    waves += `<path d="${d}" stroke="${i % 2 ? accent2 : accent}" stroke-width="1.5" fill="none" opacity="${0.3 + i * 0.1}" filter="url(#glow)"/>`;
  }
  return waves;
}

function spotlight(rng: () => number, accent: string, accent2: string): string {
  let beams = "";
  const n = 3;
  for (let i = 0; i < n; i++) {
    const topX = between(rng, 20, W - 20);
    const spread = between(rng, 30, 55);
    const bottomX = topX + between(rng, -60, 60);
    beams += `<polygon points="${topX - 8},0 ${topX + 8},0 ${bottomX + spread},${H} ${bottomX - spread},${H}" fill="${i % 2 ? accent2 : accent}" opacity="0.08"/>`;
  }
  let sparkles = "";
  for (let i = 0; i < 5; i++) {
    const x = between(rng, 20, W - 20);
    const y = between(rng, 20, H - 20);
    const s = between(rng, 3, 6);
    sparkles += `<path d="M${x},${y - s} L${x + s / 3},${y - s / 3} L${x + s},${y} L${x + s / 3},${y + s / 3} L${x},${y + s} L${x - s / 3},${y + s / 3} L${x - s},${y} L${x - s / 3},${y - s / 3} Z" fill="${accent2}" opacity="0.7" filter="url(#glow)"/>`;
  }
  return beams + sparkles;
}

function waveform(rng: () => number, accent: string, accent2: string): string {
  const bars = 18;
  const gap = 4;
  const barW = (W - 60 - (bars - 1) * gap) / bars;
  const startX = 30;
  const midY = H / 2;
  let bars_ = "";
  for (let i = 0; i < bars; i++) {
    const h = between(rng, 10, 70);
    const x = startX + i * (barW + gap);
    bars_ += `<rect x="${x}" y="${midY - h / 2}" width="${barW}" height="${h}" rx="${barW / 2}" fill="${i % 3 === 0 ? accent2 : accent}" opacity="0.55"/>`;
  }
  const s = 14;
  const tri = `<path d="M${W / 2 - s / 2},${midY - s} L${W / 2 + s},${midY} L${W / 2 - s / 2},${midY + s} Z" fill="none" stroke="${accent2}" stroke-width="1.25" opacity="0.6"/>`;
  return bars_ + tri;
}

function signalRings(rng: () => number, accent: string): string {
  const cx = between(rng, W * 0.3, W * 0.7);
  const cy = between(rng, H * 0.3, H * 0.7);
  let rings = "";
  for (let i = 0; i < 4; i++) {
    rings += `<circle cx="${cx}" cy="${cy}" r="${18 + i * 20}" fill="none" stroke="${accent}" stroke-width="1" opacity="${0.5 - i * 0.1}"/>`;
  }
  return rings;
}

// ---- theme registry ----------------------------------------------------

const THEMES: Record<string, Theme> = {
  Tech: { label: "TECH", base: "#0b1120", accent: "#22D3EE", accent2: "#818CF8", motif: circuits },
  Science: { label: "SCIENCE", base: "#07160f", accent: "#34D399", accent2: "#A3E635", motif: molecules },
  Business: { label: "BUSINESS", base: "#120d02", accent: "#FBBF24", accent2: "#FB923C", motif: chart },
  Sports: { label: "SPORTS", base: "#180a04", accent: "#FB923C", accent2: "#FBBF24", motif: motion },
  Health: { label: "HEALTH", base: "#170815", accent: "#FB7185", accent2: "#F472B6", motif: pulse },
  Top: { label: "WORLD", base: "#050d1f", accent: "#60A5FA", accent2: "#FBBF24", motif: globe },
  Politics: { label: "POLITICS", base: "#0c1016", accent: "#93C5FD", accent2: "#64748B", motif: geometric },
  Climate: { label: "CLIMATE", base: "#04140f", accent: "#2DD4BF", accent2: "#38BDF8", motif: atmosphere },
  Entertainment: { label: "ENTERTAINMENT", base: "#160a1c", accent: "#F472B6", accent2: "#C084FC", motif: spotlight },
  Videos: { label: "VIDEOS", base: "#0a0a1f", accent: "#818CF8", accent2: "#22D3EE", motif: waveform },
};

const DEFAULT_THEME: Theme = { label: "SIGNAL", base: "#0d1117", accent: "#22D3EE", accent2: "#818CF8", motif: signalRings };

export function ArticleCover({ title, category, className }: Props) {
  const uid = useId().replace(/[:]/g, "");
  const theme = THEMES[category as Category] ?? DEFAULT_THEME;

  const { markup, angle, delay1, delay2, blob1, blob2 } = useMemo(() => {
    const rng = rngFor(title || category || "untitled");
    const markup = theme.motif(rng, theme.accent, theme.accent2);
    return {
      markup,
      angle: Math.round(between(rng, 0, 360)),
      delay1: between(rng, 0, 6).toFixed(2),
      delay2: between(rng, 0, 6).toFixed(2),
      blob1: { x: between(rng, 60, 160), y: between(rng, 30, 100), r: between(rng, 70, 110) },
      blob2: { x: between(rng, 240, 340), y: between(rng, 100, 190), r: between(rng, 60, 100) },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, category]);

  const gGlow = `cvglow-${uid}`;
  const gBg = `cvbg-${uid}`;
  const gBlob1 = `cvb1-${uid}`;
  const gBlob2 = `cvb2-${uid}`;
  const gVig = `cvvig-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label={`${theme.label} illustration`}
    >
      <defs>
        <linearGradient id={gBg} x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform={`rotate(${angle} 0.5 0.5)`}>
          <stop offset="0%" stopColor={theme.base} />
          <stop offset="100%" stopColor="#05070c" />
        </linearGradient>
        <radialGradient id={gBlob1}>
          <stop offset="0%" stopColor={theme.accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={theme.accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={gBlob2}>
          <stop offset="0%" stopColor={theme.accent2} stopOpacity="0.28" />
          <stop offset="100%" stopColor={theme.accent2} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={gVig} cx="50%" cy="50%" r="75%">
          <stop offset="55%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
        </radialGradient>
        <filter id={gGlow} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* base wash */}
      <rect width={W} height={H} fill={`url(#${gBg})`} />

      {/* ambient glow blobs, slow drift */}
      <circle
        cx={blob1.x}
        cy={blob1.y}
        r={blob1.r}
        fill={`url(#${gBlob1})`}
        className="cover-blob"
        style={{ animationDelay: `${delay1}s` }}
      />
      <circle
        cx={blob2.x}
        cy={blob2.y}
        r={blob2.r}
        fill={`url(#${gBlob2})`}
        className="cover-blob cover-blob-alt"
        style={{ animationDelay: `${delay2}s` }}
      />

      {/* category motif */}
      <g style={{ filter: `url(#${gGlow})` }} dangerouslySetInnerHTML={{ __html: markup }} />

      {/* faint scanlines, ties back to the app's own terminal texture */}
      <rect width={W} height={H} fill="url(#cover-scanlines)" opacity="0.5" />

      {/* vignette for depth/premium feel */}
      <rect width={W} height={H} fill={`url(#${gVig})`} />

      {/* glassmorphic tag strip -- signature element, consistent placement
          and treatment across every category, only the label changes */}
      <g transform={`translate(${W - 96}, ${H - 30})`}>
        <rect width="86" height="20" rx="10" fill="#ffffff" opacity="0.08" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1" />
        <circle cx="14" cy="10" r="3" fill={theme.accent} className="cover-pulse-dot" />
        <text x="24" y="14" fontFamily="'JetBrains Mono', ui-monospace, monospace" fontSize="9" letterSpacing="1" fill="#ffffff" opacity="0.85">
          {theme.label}
        </text>
      </g>

      <pattern id="cover-scanlines" width="3" height="3" patternUnits="userSpaceOnUse">
        <rect width="3" height="1.2" fill="#000000" opacity="0.06" />
      </pattern>
    </svg>
  );
}
