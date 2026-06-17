import { loadSummaryCache } from "./aiCache";
import { getBriefIdentity } from "./identity";

export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
}

/* -----------------------------
   SIGNAL CLASSIFICATION LAYER
------------------------------*/

function classify(headline: string): string {
  const h = headline.toLowerCase();

  if (h.includes("market") || h.includes("economy") || h.includes("oil") || h.includes("bank"))
    return "Economic & Market Signals";

  if (h.includes("election") || h.includes("government") || h.includes("policy") || h.includes("senate"))
    return "Governance & Political Movement";

  if (h.includes("tech") || h.includes("ai") || h.includes("apple") || h.includes("software"))
    return "Technology Acceleration";

  if (h.includes("climate") || h.includes("weather") || h.includes("cop"))
    return "Climate & Environment";

  if (h.includes("war") || h.includes("ceasefire") || h.includes("security"))
    return "Security & Geopolitical Tension";

  return "General Developments";
}

/* -----------------------------
   CACHE EXTRACTION
------------------------------*/

function extractCachedSummaries(limit = 5): string[] {
  const cache = loadSummaryCache?.() || {};

  const collected: string[] = [];

  for (const key of Object.keys(cache)) {
    const lines = cache[key];
    if (Array.isArray(lines)) collected.push(...lines);
    if (collected.length >= limit) break;
  }

  return collected.slice(0, limit);
}

/* -----------------------------
   GROUP BY SIGNAL
------------------------------*/

function cluster(headlines: string[]) {
  const map: Record<string, string[]> = {};

  for (const h of headlines) {
    const key = classify(h);
    if (!map[key]) map[key] = [];
    map[key].push(h);
  }

  return map;
}

/* -----------------------------
   FALLBACK MODE (SAFE MODE)
------------------------------*/

function fallback(headlines: string[]) {
  return headlines.slice(0, 5).map((h) => `${h} is developing within today’s global cycle.`);
}

/* -----------------------------
   COUNTRY CONTEXT BUILDER
------------------------------*/

function buildCountryContext(country?: string) {
  if (!country || country === "GLOBAL") {
    return "This briefing reflects global developments across multiple regions.";
  }

  return `This briefing is contextualised for ${country}, highlighting local developments alongside global signals.`;
}

/* -----------------------------
   OPENING LINE
------------------------------*/

function buildOpening(identity: string) {
  const openings = [
    `Today’s news moves through intersecting global forces and local shifts.`,
    `Today’s briefing tracks momentum across politics, markets, and society.`,
    `Today’s developments form a layered pattern of change and reaction.`,
    `Today’s news reveals multiple pressure points shaping current events.`,
  ];

  return `Hi ${identity}, ${openings[Math.floor(Math.random() * openings.length)]}`;
}

/* -----------------------------
   CONCLUSION ENGINE (CRITICAL)
------------------------------*/

function buildConclusion(headlines: string[], country?: string) {
  const h = headlines.join(" ").toLowerCase();

  let tone = "stable but evolving";

  if (h.includes("crisis") || h.includes("war") || h.includes("conflict"))
    tone = "marked by rising geopolitical tension";

  if (h.includes("market") || h.includes("economy"))
    tone = "driven by economic adjustment and financial repositioning";

  if (h.includes("tech") || h.includes("ai"))
    tone = "shaped by rapid technological acceleration";

  if (country && country !== "GLOBAL") {
    return `Overall, ${country} is experiencing a news cycle that is ${tone}, while remaining tightly connected to broader global developments.`;
  }

  return `Overall, today’s global news cycle is ${tone}, with interconnected developments across regions reinforcing each other.`;
}

/* -----------------------------
   MAIN ENGINE
------------------------------*/

export function buildBriefing(input: BriefingInput) {
  const identity = getBriefIdentity(input.userName);

  const cached = extractCachedSummaries(5);
  const source = cached.length > 0 ? cached : fallback(input.headlines);

  const clusters = cluster(input.headlines);

  const countryContext = buildCountryContext(input.country);

  const opening = buildOpening(identity);

  const sections: string[] = [];

  // build clustered narrative
  for (const [key, items] of Object.entries(clusters)) {
    const summary = items.slice(0, 2).join(" • ");
    sections.push(`${key}: ${summary}`);
  }

  return {
    identity,
    opening,
    countryContext,
    sections: sections.slice(0, 4),
    lines: source.slice(0, 5),
    conclusion: buildConclusion(input.headlines, input.country),
  };
}
