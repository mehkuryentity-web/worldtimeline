import { loadSummaryCache } from "./aiCache";
import { getBriefIdentity } from "./identity";

export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
}

/* -----------------------------
   CLEAN HEADLINE FILTER
------------------------------*/

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

/* -----------------------------
   REMOVE SOURCE TAGS (IMPORTANT FIX)
------------------------------*/

function compressHeadline(h: string): string {
  return h
    .replace(/-.*$/, "") // removes "- SourceName"
    .replace(/\s+/g, " ")
    .trim();
}

/* -----------------------------
   IDENTITY
------------------------------*/

function buildIdentity(userName?: string | null) {
  const base = getBriefIdentity(userName);

  const fallback = [
    "ScrollSeer",
    "NewsNomad",
    "PulseWalker",
    "StoryDrifter",
  ];

  return base || fallback[Math.floor(Math.random() * fallback.length)];
}

/* -----------------------------
   OPENING
------------------------------*/

function buildOpening(identity: string, country?: string) {
  const base =
    country && country !== "GLOBAL"
      ? `${country} woke up to a mixed bag of chaos and charm today as`
      : `The world woke up to a mixed bag of chaos and charm today as`;

  return `Hi ${identity}, ${base} five headline stories shaped today’s mood.`;
}

/* -----------------------------
   STORY BUILDER
------------------------------*/

function buildStory(headlines: string[], country?: string, identity?: string) {
  const top = headlines.slice(0, 5);

  const intro = buildOpening(identity || "Reader", country);

  const hooks = ["First,", "Second,", "Third,", "Fourth,", "Finally,"];

  const body = top.map((h, i) => {
    const clean = compressHeadline(h);

    return `${hooks[i]} ${clean} shaped part of today’s unfolding narrative.`;
  });

  const conclusion =
    "In the end, today didn’t just deliver news — it became a connected story unfolding in real time.";

  return { intro, body, conclusion };
}

/* -----------------------------
   COUNTRY CONTEXT
------------------------------*/

function buildCountryContext(country?: string) {
  if (!country || country === "GLOBAL") {
    return "This briefing connects local developments with broader global momentum.";
  }

  return `This briefing is grounded in ${country}, shaped by global pressures influencing local outcomes.`;
}

/* -----------------------------
   CACHE
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
   FALLBACK
------------------------------*/

function fallback(headlines: string[]) {
  return headlines.filter(Boolean).slice(0, 5);
}

/* -----------------------------
   MAIN ENGINE
------------------------------*/

export function buildBriefing(input: BriefingInput) {
  const clean = input.headlines.filter(isCleanHeadline);

  const source = clean.length > 0 ? clean : fallback(input.headlines);

  const cached = extractCachedSummaries(5);

  const final = cached.length > 0 ? cached : source;

  const identity = buildIdentity(input.userName);

  const story = buildStory(final, input.country, identity);

  return {
    identity,
    opening: story.intro,
    countryContext: buildCountryContext(input.country),
    sections: story.body,
    lines: story.body,
    conclusion: story.conclusion,
  };
}
