import { getBriefIdentity } from "./identity";

export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
}

/* -----------------------------
   HEADLINE CLEANER
------------------------------*/

function clean(headlines: string[]) {
  return headlines
    .filter(Boolean)
    .filter((h) => typeof h === "string")
    .filter((h) => h.length > 25)
    .filter((h) => !h.toLowerCase().includes("frontiers |"))
    .slice(0, 12);
}

/* -----------------------------
   IDENTITY (SINGLE SOURCE)
------------------------------*/

function identity(userName?: string | null) {
  return getBriefIdentity(userName);
}

/* -----------------------------
   COUNTRY CONTEXT
------------------------------*/

function countryContext(country?: string) {
  if (!country || country === "GLOBAL") {
    return "global";
  }
  return country;
}

/* -----------------------------
   OPENING LINE
------------------------------*/

function buildOpening(name: string, country: string) {
  const hooks = [
    "today unfolds like interconnected stories refusing to stay separate.",
    "today moves with quiet tension and unexpected turns.",
    "today reads like events are reacting to each other in real time.",
    "today carries a mix of pressure, change, and momentum.",
  ];

  const hook = hooks[Math.floor(Math.random() * hooks.length)];

  return `Hi ${name}, ${country === "global" ? "today’s global briefing" : `today in ${country}`} ${hook}`;
}

/* -----------------------------
   STORY TRANSFORMER
------------------------------*/

function transform(headline: string) {
  const h = headline.replace(/\s+/g, " ").trim();

  const tones = [
    "is shaping today’s unfolding narrative",
    "is feeding into a larger chain of developments",
    "is adding momentum to ongoing shifts",
    "is part of today’s connected storyline",
    "is influencing the broader news cycle",
  ];

  const tone = tones[Math.floor(Math.random() * tones.length)];

  return `${h} ${tone}.`;
}

/* -----------------------------
   CONCLUSION (ONE LINE ONLY)
------------------------------*/

function buildConclusion(country: string, headlines: string[]) {
  const h = headlines.join(" ").toLowerCase();

  let mood = "balanced but active";

  if (h.includes("war") || h.includes("conflict")) mood = "tense and geopolitically sensitive";
  if (h.includes("market") || h.includes("economy")) mood = "economically reactive";
  if (h.includes("ai") || h.includes("tech")) mood = "driven by rapid technological acceleration";

  if (country === "global") {
    return `Overall, today’s global cycle remains ${mood}, with tightly linked developments across regions.`;
  }

  return `Overall, ${country} remains in a ${mood} news cycle shaped by both local and global forces.`;
}

/* -----------------------------
   MAIN ENGINE (LOCKED)
------------------------------*/

export function buildBriefing(input: BriefingInput) {
  const cleaned = clean(input.headlines);

  const name = identity(input.userName);
  const country = countryContext(input.country);

  // FORCE EXACTLY 5 STORIES
  const stories = cleaned.slice(0, 5).map(transform);

  // If not enough headlines, pad safely
  while (stories.length < 5) {
    stories.push("Developments continue to evolve across multiple sectors.");
  }

  return {
    opening: buildOpening(name, country),
    stories,
    conclusion: buildConclusion(country, cleaned),
    identity: name,
  };
}
