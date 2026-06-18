import { getBriefIdentity } from "./identity";

export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
}

/* ---------------------------------------
   IDENTITY (FIXED PRIORITY LOGIC)
----------------------------------------*/

function resolveIdentity(userName?: string | null) {
  // STRICT RULE:
  // if user exists → always use it
  // else → generate fallback identity
  const base = getBriefIdentity(userName);

  return userName && userName.trim().length > 0 ? userName : base;
}

/* ---------------------------------------
   CLEAN HEADLINES
----------------------------------------*/

function clean(h: string) {
  return h
    .replace(/—.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------------------------------------
   THEME DETECTION (DRIVES OPENING + CONCLUSION)
----------------------------------------*/

function detectThemes(headlines: string[]) {
  const text = headlines.join(" ").toLowerCase();

  const themes: string[] = [];

  if (text.includes("ai") || text.includes("tech") || text.includes("software"))
    themes.push("technology acceleration");

  if (text.includes("election") || text.includes("government") || text.includes("policy"))
    themes.push("political movement");

  if (text.includes("market") || text.includes("economy") || text.includes("bank"))
    themes.push("economic pressure");

  if (text.includes("war") || text.includes("conflict") || text.includes("security"))
    themes.push("geopolitical tension");

  if (text.includes("health") || text.includes("hospital"))
    themes.push("public health developments");

  if (themes.length === 0) themes.push("mixed sector activity");

  return themes;
}

/* ---------------------------------------
   DYNAMIC OPENING (NO TEMPLATES)
----------------------------------------*/

function buildOpening(name: string, country?: string, themes?: string[]) {
  const region = country && country !== "GLOBAL" ? country : "global";

  const toneA = [
    "moves through overlapping signals",
    "opens with competing currents",
    "unfolds across multiple pressure points",
    "starts with fragmented but connected developments",
  ];

  const selectedTone = toneA[Math.floor(Math.random() * toneA.length)];

  const themeText = themes?.length
    ? themes.join(", ")
    : "multiple global developments";

  return `Hi ${name}, ${region} today ${selectedTone} shaped by ${themeText}.`;
}

/* ---------------------------------------
   TRANSITION ENGINE
----------------------------------------*/

const transitions = [
  "Meanwhile,",
  "At the same time,",
  "Elsewhere,",
  "In another thread,",
  "Across another layer of reporting,",
];

/* ---------------------------------------
   NEWSROOM PARAGRAPH BUILDER
----------------------------------------*/

function buildParagraph(headlines: string[]) {
  const top5 = headlines.slice(0, 5);

  return top5
    .map((h, i) => {
      const story = clean(h);

      if (i === 0) return story;

      const t = transitions[Math.floor(Math.random() * transitions.length)];

      return `${t} ${story}`;
    })
    .join(" ");
}

/* ---------------------------------------
   DYNAMIC CONCLUSION (NO STATIC PHRASES)
----------------------------------------*/

function buildConclusion(headlines: string[], themes: string[]) {
  const text = headlines.join(" ").toLowerCase();

  let tone = "mixed activity across sectors";

  if (text.includes("war") || text.includes("conflict"))
    tone = "rising geopolitical pressure";

  if (text.includes("economy") || text.includes("market"))
    tone = "economic repositioning underway";

  if (text.includes("tech"))
    tone = "accelerating technological momentum";

  const themeLine =
    themes.length > 1
      ? `The dominant threads are ${themes.join(" and ")}.`
      : `The dominant thread is ${themes[0]}.`;

  return `Overall, today reflects ${tone}. ${themeLine} The system does not settle — it continuously rebalances itself.`;
}

/* ---------------------------------------
   MAIN ENGINE
----------------------------------------*/

export function buildBriefing(input: BriefingInput) {
  const identity = resolveIdentity(input.userName);

  const themes = detectThemes(input.headlines);

  return {
    identity,
    opening: buildOpening(identity, input.country, themes),
    newsroomParagraph: buildParagraph(input.headlines),
    conclusion: buildConclusion(input.headlines, themes),
  };
}
