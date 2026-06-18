import { getBriefIdentity } from "./identity";

export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
  refreshKey?: number;
}

/* -------------------------------------------------
   HARD STYLE LOCK (KILLS AI TONE RESIDUE)
--------------------------------------------------*/

const BLOCKED_PHRASES = [
  "does not exist in isolation",
  "larger pattern",
  "connected storyline",
  "global cycle",
  "unfolding narrative",
  "part of today",
  "shaped by",
  "is adding momentum",
];

function stripAI(text: string) {
  let t = text;
  for (const p of BLOCKED_PHRASES) {
    t = t.replace(new RegExp(p, "gi"), "");
  }
  return t
    .replace(/\s+/g, " ")
    .replace(/\-\s+$/, "")
    .trim();
}

function cleanHeadlines(headlines: string[]) {
  return headlines
    .map(stripAI)
    .filter(Boolean)
    .filter((h) => h.length > 20)
    .slice(0, 20);
}

/* -------------------------------------------------
   IDENTITY
--------------------------------------------------*/

function identity(userName?: string | null) {
  return getBriefIdentity(userName);
}

/* -------------------------------------------------
   COUNTRY CONTEXT
--------------------------------------------------*/

function country(country?: string) {
  return !country || country === "GLOBAL" ? "global" : country;
}

/* -------------------------------------------------
   OPENING (CONVERSATIONAL, NOT REPORTIVE)
--------------------------------------------------*/

function opening(name: string, region: string) {
  const hooks = [
    "today is moving like it woke up late and is trying to catch up aggressively.",
    "today feels slightly uncoordinated but oddly connected.",
    "today is loud in different directions at once.",
    "today behaves like it has too many tabs open in its head.",
  ];

  const hook = hooks[Math.floor(Math.random() * hooks.length)];

  return `Hi ${name}, ${region === "global" ? "global briefing" : region} — ${hook}`;
}

/* -------------------------------------------------
   STORY TRANSFORM (HUMAN VOICE, NO AI FILLER)
--------------------------------------------------*/

function story(headline: string) {
  const endings = [
    "— and that’s still unfolding.",
    "— and it’s dragging attention with it.",
    "— and people are already reacting to it.",
    "— and it’s not sitting quietly in the background.",
  ];

  const end = endings[Math.floor(Math.random() * endings.length)];

  return `${headline} ${end}`;
}

/* -------------------------------------------------
   CONCLUSION (SINGLE LINE, SHARP, HUMAN)
--------------------------------------------------*/

function conclusion(headlines: string[], region: string) {
  const text = headlines.join(" ").toLowerCase();

  let tone = "uneven and reactive";

  if (text.includes("war") || text.includes("conflict")) {
    tone = "tense and unstable";
  } else if (text.includes("economy") || text.includes("market")) {
    tone = "financially jittery";
  } else if (text.includes("tech") || text.includes("ai")) {
    tone = "moving faster than understanding";
  }

  const endings = [
    "Nothing is settled — it’s just moving in different directions at once.",
    "It’s all connected, but nothing is coordinated.",
    "Today didn’t calm down — it scattered more evenly.",
    "The noise is structured, not random.",
  ];

  const end = endings[Math.floor(Math.random() * endings.length)];

  return region === "global"
    ? `Overall, today’s global mood is ${tone}. ${end}`
    : `Overall, ${region} feels ${tone}. ${end}`;
}

/* -------------------------------------------------
   MAIN ENGINE
--------------------------------------------------*/

export function buildBriefing(input: BriefingInput) {
  const cleaned = cleanHeadlines(input.headlines);

  const name = identity(input.userName);
  const region = country(input.country);

  const openingLine = opening(name, region);

  const stories = cleaned.slice(0, 5).map(story);

  while (stories.length < 5) {
    stories.push("Another story is still developing quietly in the background.");
  }

  return {
    identity: name,
    opening: openingLine,
    stories,
    conclusion: conclusion(cleaned, region),
  };
}
