import { getBriefIdentity } from "./identity";

export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
}

/* ---------------------------------------
   YOUR STYLE LOCK (HARD INJECTION)
----------------------------------------*/

const STYLE_SAMPLE = `
Hi [Name],
Nigeria woke up to a mixed bag of chaos and charm today as five headline stories shaped the mood of the nation.
Each story should feel like part of a lived world, not a report.
End with a one-line punchy conclusion.
Humour is subtle, observational, slightly ironic, never robotic.
No phrases like: "global cycle", "connected storyline", "unfolding narrative".
No repetitive endings like "and it’s pulling attention".
`;

/* ---------------------------------------
   CLEANER (REMOVES AI TEMPLATE VOICE)
----------------------------------------*/

const BAD = [
  "global cycle",
  "connected storyline",
  "unfolding narrative",
  "pulling attention",
  "part of today",
  "is adding momentum",
];

function clean(text: string) {
  let t = text;
  BAD.forEach((b) => {
    t = t.replace(new RegExp(b, "gi"), "");
  });

  return t.replace(/\s+/g, " ").trim();
}

/* ---------------------------------------
   IDENTITY
----------------------------------------*/

function identity(name?: string | null) {
  return getBriefIdentity(name);
}

/* ---------------------------------------
   OPENING (HUMAN STYLE LIKE YOUR SAMPLE)
----------------------------------------*/

function opening(name: string, country?: string) {
  const hooks = [
    "today didn’t arrive quietly, it showed up with mixed signals and moving parts.",
    "today feels like multiple stories sharing the same street.",
    "today carries both tension and charm in equal measure.",
    "today is busy, slightly chaotic, but meaningfully connected.",
  ];

  const h = hooks[Math.floor(Math.random() * hooks.length)];

  return `Hi ${name}, ${country ?? "global"} woke up to ${h}`;
}

/* ---------------------------------------
   STORY FORMAT (MATCH YOUR SAMPLE STYLE)
----------------------------------------*/

function story(h: string) {
  const endings = [
    "The impact is still unfolding quietly.",
    "Reactions are already building around it.",
    "The ripple effect is visible.",
    "It continues to shape local direction.",
  ];

  return `${clean(h)} — ${endings[Math.floor(Math.random() * endings.length)]}`;
}

/* ---------------------------------------
   CONCLUSION (ONE LINER STYLE LIKE YOURS)
----------------------------------------*/

function conclusion(headlines: string[]) {
  const text = headlines.join(" ").toLowerCase();

  let tone = "balanced chaos";

  if (text.includes("war")) tone = "tension rising beneath structured calm";
  if (text.includes("economy")) tone = "economic pressure shaping sentiment";
  if (text.includes("tech")) tone = "fast-moving innovation pressure";

  const endings = [
    "In the end, today didn’t just deliver news — it moved like a single connected story.",
    "In the end, nothing stands alone today — everything reacts to everything.",
    "In the end, today feels less reported and more experienced.",
  ];

  return `Overall, today reflects ${tone}. ${
    endings[Math.floor(Math.random() * endings.length)]
  }`;
}

/* ---------------------------------------
   MAIN ENGINE
----------------------------------------*/

export function buildBriefing(input: BriefingInput) {
  const name = identity(input.userName);

  return {
    style: STYLE_SAMPLE,
    identity: name,
    opening: opening(name, input.country),
    stories: input.headlines.slice(0, 5).map(story),
    conclusion: conclusion(input.headlines),
  };
}
