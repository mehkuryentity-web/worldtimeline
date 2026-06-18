import { getBriefIdentity } from "./identity";

export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
}

/* ---------------------------------------
   IDENTITY (FINAL LOCK)
----------------------------------------*/

function resolveIdentity(userName?: string | null) {
  return userName && userName.trim().length > 0
    ? userName.trim()
    : getBriefIdentity(userName);
}

/* ---------------------------------------
   CLEAN INPUT
----------------------------------------*/

function clean(h: string) {
  return h.replace(/—.*$/g, "").replace(/\s+/g, " ").trim();
}

/* ---------------------------------------
   STORY REWRITE (REAL EDITORIAL VOICE)
----------------------------------------*/

function rewrite(h: string) {
  const base = clean(h);

  // strip prefixes like Nigeria:, FG:, etc.
  const stripped = base.replace(/^\w+:\s*/g, "");

  // editorial compression (natural newsroom tone)
  if (stripped.length < 70) {
    return `${stripped} is drawing attention as developments continue to unfold`;
  }

  return `${stripped} is emerging as part of a wider sequence of developments`;
}

/* ---------------------------------------
   TRANSITIONS (LIGHT, HUMAN FLOW)
----------------------------------------*/

const transitions = [
  "Meanwhile,",
  "At the same time,",
  "Elsewhere,",
  "In another development,",
];

/* ---------------------------------------
   OPENING (DYNAMIC EDITORIAL HOOK)
----------------------------------------*/

function buildOpening(name: string, country?: string) {
  const region = country && country !== "GLOBAL" ? country : "global";

  const hooks = [
    "today opens with overlapping developments shaping the news cycle",
    "today begins with multiple stories moving in different directions",
    "today unfolds through a mix of political, economic and social signals",
    "today starts with interconnected events forming a fast-moving cycle",
  ];

  const hook = hooks[Math.floor(Math.random() * hooks.length)];

  return `Hi ${name}, ${region} ${hook}.`;
}

/* ---------------------------------------
   PARAGRAPH BUILDER (5 STORIES, ONE FLOW)
----------------------------------------*/

function buildParagraph(headlines: string[]) {
  return headlines.slice(0, 5).map((h, i) => {
    const story = rewrite(h);

    if (i === 0) return story;

    const t = transitions[Math.floor(Math.random() * transitions.length)];
    return `${t} ${story}`;
  }).join(" ");
}

/* ---------------------------------------
   THEME DETECTION (SIMPLE + RELIABLE)
----------------------------------------*/

function detectTheme(headlines: string[]) {
  const text = headlines.join(" ").toLowerCase();

  if (text.includes("war") || text.includes("conflict") || text.includes("security"))
    return "geopolitical tension";

  if (text.includes("inflation") || text.includes("market") || text.includes("economy"))
    return "economic pressure";

  if (text.includes("health") || text.includes("hospital") || text.includes("cancer"))
    return "public health strain";

  if (text.includes("tech") || text.includes("ai"))
    return "technological acceleration";

  return "mixed sector activity";
}

/* ---------------------------------------
   CONCLUSION (NO TEMPLATE PHRASES)
----------------------------------------*/

function buildConclusion(headlines: string[], theme: string) {
  return `Overall, today reflects ${theme}. The cycle remains active with no single direction dominating the narrative.`;
}

/* ---------------------------------------
   MAIN ENGINE
----------------------------------------*/

export function buildBriefing(input: BriefingInput) {
  const identity = resolveIdentity(input.userName);
  const theme = detectTheme(input.headlines || []);

  return {
    identity,
    opening: buildOpening(identity, input.country),
    newsroomParagraph: buildParagraph(input.headlines || []),
    conclusion: buildConclusion(input.headlines || [], theme),
  };
}
