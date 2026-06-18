import { loadSummaryCache } from "./aiCache";
import { getBriefIdentity } from "./identity";

export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
}

/* -------------------------------------------------
   1. HARD FILTER — REMOVE NOISE / ACADEMIC FEEDS
--------------------------------------------------*/

function isCleanHeadline(h: string): boolean {
  const x = h.toLowerCase();

  const blocked = [
    "frontiers",
    "arxiv",
    "doi",
    "css",
    "javascript",
    "react",
    "tutorial",
    "conference",
    "abstract",
    "paper",
    "study",
    "journal",
    "volume",
    "issue",
  ];

  return !blocked.some((b) => x.includes(b));
}

/* -------------------------------------------------
   2. IDENTITY ENGINE
--------------------------------------------------*/

function buildIdentityLine(userName?: string | null) {
  const identity = getBriefIdentity(userName);

  const fallbackNames = [
    "ScrollSeer",
    "StoryDrifter",
    "NewsNomad",
    "PulseWalker",
    "SignalRider",
    "ChronoScout",
  ];

  return identity || fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
}

/* -------------------------------------------------
   3. HUMOUR ENGINE (NEW CORE LAYER)
--------------------------------------------------*/

function addWit(text: string): string {
  const t = text.toLowerCase();

  if (t.includes("power") || t.includes("grid")) {
    return text + " (the grid briefly went offline for its usual identity crisis)";
  }

  if (t.includes("fuel") || t.includes("queue")) {
    return text + " (fuel queues made a surprise return like an unwanted sequel)";
  }

  if (t.includes("market") || t.includes("stocks")) {
    return text + " (markets are emotionally reacting again — as usual)";
  }

  if (t.includes("football") || t.includes("match") || t.includes("goal")) {
    return text + " (football drama escalated as expected, sanity optional)";
  }

  if (t.includes("rain") || t.includes("weather")) {
    return text + " (weather ignored all previous human plans)";
  }

  return text;
}

/* -------------------------------------------------
   4. OPENING (MATCHES YOUR STYLE)
--------------------------------------------------*/

function buildOpening(identity: string, country?: string) {
  const base =
    country && country !== "GLOBAL"
      ? `${country} woke up to a mixed bag of chaos and charm today as`
      : `The world woke up to a mixed bag of chaos and charm today as`;

  return `Hi ${identity}, ${base} five headline stories shaped today’s mood.`;
}

/* -------------------------------------------------
   5. STORY BUILDER (HUMAN + WIT + FLOW)
--------------------------------------------------*/

function buildStory(headlines: string[], country?: string) {
  const top = headlines.slice(0, 5);

  const intro = buildOpening(buildIdentityLine(), country);

  const hooks = ["First,", "Second,", "Third,", "Fourth,", "Finally,"];

  const body = top.map((h, i) => {
    const clean = h
      .replace(/\s+/g, " ")
      .replace(/\.$/, "")
      .trim();

    const witty = addWit(clean);

    return `${hooks[i] || "Next,"} ${witty} shaped part of today’s unfolding narrative.`;
  });

  const conclusion =
    "In the end, today didn’t just deliver news — it behaved like a connected storyline unfolding in real time.";

  return {
    intro,
    body,
    conclusion,
  };
}

/* -------------------------------------------------
   6. COUNTRY CONTEXT
--------------------------------------------------*/

function buildCountryContext(country?: string) {
  if (!country || country === "GLOBAL") {
    return "This briefing connects local developments with broader global momentum.";
  }

  return `This briefing is grounded in ${country}, while still reflecting global pressure shaping local outcomes.`;
}

/* -------------------------------------------------
   7. FALLBACK (SAFE MODE)
--------------------------------------------------*/

function fallback(headlines: string[]) {
  return headlines.filter(Boolean).slice(0, 5);
}

/* -------------------------------------------------
   8. CACHE EXTRACTION
--------------------------------------------------*/

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

/* -------------------------------------------------
   9. MAIN ENGINE (FINAL OUTPUT)
--------------------------------------------------*/

export function buildBriefing(input: BriefingInput) {
  const cleanHeadlines = input.headlines.filter(isCleanHeadline);

  const source =
    cleanHeadlines.length > 0 ? cleanHeadlines : fallback(input.headlines);

  const cached = extractCachedSummaries(5);

  const finalSource = cached.length > 0 ? cached : source;

  const identity = buildIdentityLine(input.userName);

  const story = buildStory(finalSource, input.country);

  const countryContext = buildCountryContext(input.country);

  return {
    identity,
    opening: story.intro,
    countryContext,
    sections: story.body,
    lines: story.body,
    conclusion: story.conclusion,
  };
}
