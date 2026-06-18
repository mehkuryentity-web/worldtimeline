import { getBriefIdentity } from "./identity";

export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
  refreshKey?: number;
}

/* -------------------------------------------------
   STRICT CLEANING LAYER (NO AI FLUFF ALLOWED)
--------------------------------------------------*/

const BAD_PATTERNS = [
  "adding momentum",
  "connected storyline",
  "unfolding narrative",
  "shaped part of today",
  "is part of today",
  "global cycle",
  "developing within today",
];

function sanitize(text: string) {
  let t = text;
  for (const p of BAD_PATTERNS) {
    t = t.replace(new RegExp(p, "gi"), "");
  }
  return t.trim();
}

function cleanHeadlines(headlines: string[]) {
  return headlines
    .map(sanitize)
    .filter(Boolean)
    .filter((h) => h.length > 20)
    .slice(0, 20);
}

/* -------------------------------------------------
   IDENTITY SYSTEM
--------------------------------------------------*/

function resolveIdentity(userName?: string | null) {
  return getBriefIdentity(userName);
}

/* -------------------------------------------------
   COUNTRY CONTEXT
--------------------------------------------------*/

function countryContext(country?: string) {
  if (!country || country === "GLOBAL") {
    return "global";
  }
  return country;
}

/* -------------------------------------------------
   OPENING (CONVERSATIONAL + WITTY)
--------------------------------------------------*/

function buildOpening(name: string, country: string) {
  const hooks = [
    "today feels like everything is talking at once and nothing is waiting its turn.",
    "today is moving like a group chat nobody can mute.",
    "today has too many headlines and not enough patience.",
    "today behaves like chaos with a schedule.",
    "today is loud in different directions at the same time.",
  ];

  const hook = hooks[Math.floor(Math.random() * hooks.length)];

  return `Hi ${name}, ${country === "global" ? "global briefing" : country} — ${hook}`;
}

/* -------------------------------------------------
   STORY TRANSFORMATION (NO ECHOING HEADLINES)
--------------------------------------------------*/

function buildStory(headline: string) {
  const tails = [
    "It doesn’t sit alone in today’s cycle.",
    "It’s quietly pulling other stories into its orbit.",
    "It’s part of a larger pattern forming underneath the noise.",
    "It doesn’t exist in isolation today.",
  ];

  const tail = tails[Math.floor(Math.random() * tails.length)];

  return `${headline} — ${tail}`;
}

/* -------------------------------------------------
   CONCLUSION (SINGLE LINE + EDGE)
--------------------------------------------------*/

function buildConclusion(headlines: string[], country: string) {
  const text = headlines.join(" ").toLowerCase();

  let tone = "controlled chaos";

  if (text.includes("war") || text.includes("conflict")) {
    tone = "tense geopolitical pressure";
  } else if (text.includes("economy") || text.includes("market")) {
    tone = "financial systems under strain";
  } else if (text.includes("tech") || text.includes("ai")) {
    tone = "rapid technological acceleration";
  }

  const endings = [
    "Nothing is calm — it’s just evenly distributed noise.",
    "The world didn’t slow down; it got better at pretending it did.",
    "Today didn’t report news — it exposed pressure.",
    "Everything is connected, nothing is waiting.",
  ];

  const ending = endings[Math.floor(Math.random() * endings.length)];

  return country === "global"
    ? `Overall, today’s global cycle reflects ${tone}. ${ending}`
    : `Overall, ${country} reflects ${tone}. ${ending}`;
}

/* -------------------------------------------------
   MAIN BRIEFING ENGINE
--------------------------------------------------*/

export function buildBriefing(input: BriefingInput) {
  const cleaned = cleanHeadlines(input.headlines);

  const identity = resolveIdentity(input.userName);
  const country = countryContext(input.country);

  const opening = buildOpening(identity, country);

  // FORCE 5 STORIES ALWAYS
  const stories = cleaned.slice(0, 5).map(buildStory);

  while (stories.length < 5) {
    stories.push("A developing story continues to evolve quietly in the background.");
  }

  return {
    identity,
    opening,
    stories,
    conclusion: buildConclusion(cleaned, country),
  };
}
