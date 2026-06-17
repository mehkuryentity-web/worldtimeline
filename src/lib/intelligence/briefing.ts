import { loadSummaryCache } from "./aiCache";
import { getBriefIdentity } from "./identity";

export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
}

/**
 * Pulls cached AI summaries and builds a ranked briefing
 * Priority:
 * 1. Cached AI summaries (article-level intelligence)
 * 2. Fallback to raw headlines
 */
function extractTopSummaries(limit = 5): string[] {
  const cache = loadSummaryCache?.() || {};

  const collected: string[] = [];

  for (const key of Object.keys(cache)) {
    const lines = cache[key];
    if (Array.isArray(lines)) {
      collected.push(...lines);
    }
    if (collected.length >= limit) break;
  }

  return collected.slice(0, limit);
}

/**
 * Fallback if cache is empty
 */
function fallback(headlines: string[]): string[] {
  return [
    `${headlines[0] ?? "Global markets"} are shaping today’s opening narrative.`,
    `${headlines[1] ?? "Political signals"} are shifting across key regions.`,
    `${headlines[2] ?? "Tech developments"} continue to accelerate quietly.`,
    `${headlines[3] ?? "Global events"} remain fluid and interconnected.`,
    `${headlines[4] ?? "Breaking stories"} are still unfolding in real time.`,
  ];
}

/**
 * Creates dynamic opening line
 */
function buildOpening(identity: string): string {
  const openings = [
    `Today’s news begins with movements that are reshaping the global rhythm.`,
    `Today’s news opens like a thread pulling multiple stories into focus.`,
    `Today’s news starts where attention meets acceleration.`,
    `Today’s news unfolds across signals, tension, and momentum.`,
    `Today’s news begins with developments you’ll want to track closely.`,
  ];

  return `Hi ${identity}, ${openings[Math.floor(Math.random() * openings.length)]}`;
}

/**
 * MAIN EXPORT — SINGLE BRIEFING GENERATOR
 */
export function buildBriefing(input: BriefingInput) {
  const identity = getBriefIdentity(input.userName);

  const top = extractTopSummaries(5);
  const lines = top.length > 0 ? top : fallback(input.headlines);

  return {
    identity,
    opening: buildOpening(identity),
    lines: lines.slice(0, 5),
  };
}
