import { loadSummaryCache } from "./aiCache";
import { getBriefIdentity } from "./identity";

export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
}

/* -----------------------------
   CLEAN CLASSIFIER (lightweight grouping)
------------------------------*/

function classify(headline: string): string {
  const h = headline.toLowerCase();

  if (h.includes("market") || h.includes("economy") || h.includes("oil") || h.includes("bank")) {
    return "Markets & Economy";
  }

  if (h.includes("election") || h.includes("government") || h.includes("policy") || h.includes("senate")) {
    return "Politics & Governance";
  }

  if (h.includes("tech") || h.includes("ai") || h.includes("software") || h.includes("apple") || h.includes("google")) {
    return "Technology";
  }

  if (h.includes("war") || h.includes("conflict") || h.includes("ceasefire") || h.includes("security")) {
    return "Geopolitics & Security";
  }

  if (h.includes("climate") || h.includes("weather") || h.includes("cop")) {
    return "Climate & Environment";
  }

  return "General Updates";
}

/* -----------------------------
   CACHE EXTRACTION
------------------------------*/

function extractCachedSummaries(limit = 5): string[] {
  const cache = loadSummaryCache();
  const collected: string[] = [];

  for (const key of Object.keys(cache)) {
    const lines = cache[key];
    if (Array.isArray(lines)) collected.push(...lines);
    if (collected.length >= limit) break;
  }

  return collected.slice(0, limit);
}

/* -----------------------------
   COUNTRY CONTEXT
------------------------------*/

function buildCountryContext(country?: string) {
  if (!country || country === "GLOBAL") {
    return "Coverage spans global developments across multiple regions.";
  }

  return `Coverage includes developments relevant to ${country}, connected to wider global shifts.`;
}

/* -----------------------------
   OPENING GENERATOR (CLEAN + NO DUPLICATION)
------------------------------*/

function buildOpening(identity: string) {
  const openings = [
    "Today’s news is moving across multiple pressure points at once.",
    "Today’s briefing captures fast-moving developments across sectors.",
    "Today’s developments show interconnected shifts across politics, markets, and society.",
    "Today’s news reflects overlapping changes shaping the global cycle.",
  ];

  const pick = openings[Math.floor(Math.random() * openings.length)];

  return `Hi ${identity}, ${pick}`;
}

/* -----------------------------
   CONCLUSION ENGINE (STRUCTURAL SUMMARY)
------------------------------*/

function buildConclusion(headlines: string[], country?: string) {
  const text = headlines.join(" ").toLowerCase();

  let tone = "steady but evolving";

  if (text.includes("war") || text.includes("conflict") || text.includes("attack")) {
    tone = "marked by rising geopolitical tension";
  }

  if (text.includes("market") || text.includes("economy") || text.includes("inflation")) {
    tone = "driven by financial recalibration";
  }

  if (text.includes("ai") || text.includes("tech") || text.includes("software")) {
    tone = "shaped by rapid technological acceleration";
  }

  if (country && country !== "GLOBAL") {
    return `Overall, ${country}'s news landscape is ${tone}, tightly linked to global momentum.`;
  }

  return `Overall, global developments remain ${tone}, with cross-regional effects reinforcing each other.`;
}

/* -----------------------------
   FALLBACK (NO JUNK SENTENCES)
------------------------------*/

function fallback(headlines: string[]) {
  return headlines.slice(0, 5);
}

/* -----------------------------
   CLUSTERING
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
