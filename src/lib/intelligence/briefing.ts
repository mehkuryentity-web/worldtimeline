import { getBriefIdentity } from "./identity";

export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
}

/* -----------------------------
   IDENTITY
------------------------------*/

function identity(name?: string | null) {
  return getBriefIdentity(name);
}

/* -----------------------------
   OPENING (EDITORIAL VOICE)
------------------------------*/

function opening(name: string, country?: string) {
  const hooks = [
    "today is unfolding in uneven bursts across multiple fronts.",
    "today moves like a newsroom under pressure, stitching unrelated events into one frame.",
    "today feels dense, fast, and slightly unpredictable in direction.",
    "today carries overlapping developments that refuse to stay in their lanes.",
  ];

  return `Hi ${name}, ${country ?? "global"} — ${
    hooks[Math.floor(Math.random() * hooks.length)]
  }`;
}

/* -----------------------------
   CLEAN HEADLINE
------------------------------*/

function clean(h: string) {
  return h
    .replace(/—.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* -----------------------------
   TRANSITION ENGINE (EDITOR FLOW)
------------------------------*/

const transitions = [
  "Meanwhile,",
  "At the same time,",
  "Across another line of reporting,",
  "Elsewhere in the cycle,",
  "In parallel,",
];

/* -----------------------------
   LIVE NEWSROOM PARAGRAPH BUILDER
------------------------------*/

function buildNewsroomParagraph(headlines: string[]) {
  const top5 = headlines.slice(0, 5);

  return top5
    .map((h, i) => {
      const story = clean(h);

      if (i === 0) return story;

      const t = transitions[Math.floor(Math.random() * transitions.length)];

      return `${t} ${story}`;
    })
    .join(". ");
}

/* -----------------------------
   CONCLUSION (EDITOR CLOSE)
------------------------------*/

function conclusion(headlines: string[]) {
  const text = headlines.join(" ").toLowerCase();

  let tone = "mixed momentum across sectors";

  if (text.includes("war") || text.includes("conflict")) tone = "rising geopolitical pressure";
  if (text.includes("economy") || text.includes("market")) tone = "financial repositioning underway";
  if (text.includes("tech")) tone = "rapid technological acceleration";

  const closers = [
    "The day doesn’t resolve itself — it continues to reorganise in real time.",
    "Nothing settles cleanly today; everything keeps shifting shape.",
    "It reads less like updates and more like a single evolving sequence.",
  ];

  return `Overall, today reflects ${tone}. ${
    closers[Math.floor(Math.random() * closers.length)]
  }`;
}

/* -----------------------------
   MAIN ENGINE
------------------------------*/

export function buildBriefing(input: BriefingInput) {
  const name = identity(input.userName);

  return {
    identity: name,
    opening: opening(name, input.country),

    // 🔥 THIS IS THE CORE CHANGE
    newsroomParagraph: buildNewsroomParagraph(input.headlines),

    conclusion: conclusion(input.headlines),
  };
}
