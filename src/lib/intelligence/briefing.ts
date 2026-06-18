import { getBriefIdentity } from "./identity";

export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
  refreshKey?: number;
}

const BAD = [
  "global cycle",
  "connected storyline",
  "unfolding narrative",
  "part of today",
  "adding momentum",
  "is part of",
];

function clean(text: string) {
  let t = text;
  BAD.forEach((b) => {
    t = t.replace(new RegExp(b, "gi"), "");
  });
  return t.replace(/\s+/g, " ").trim();
}

function identity(name?: string | null) {
  return getBriefIdentity(name);
}

function opening(name: string, country?: string) {
  const hooks = [
    "today feels slightly off-balance but active.",
    "today is moving fast without coordination.",
    "today feels like too many things happening at once.",
    "today has no patience for structure.",
  ];

  const h = hooks[Math.floor(Math.random() * hooks.length)];

  return `Hi ${name}, ${country ?? "global"} — ${h}`;
}

function story(h: string) {
  const tails = [
    "and it’s still developing.",
    "and people are reacting to it.",
    "and it’s not settled yet.",
    "and it’s pulling attention with it.",
  ];

  return `${clean(h)} — ${tails[Math.floor(Math.random() * tails.length)]}`;
}

function conclusion(headlines: string[], country?: string) {
  const text = headlines.join(" ").toLowerCase();

  let tone = "uneven";

  if (text.includes("war")) tone = "tense";
  if (text.includes("economy")) tone = "financially unstable";
  if (text.includes("tech")) tone = "rapidly accelerating";

  const endings = [
    "Nothing is stable — everything is moving at different speeds.",
    "The pattern exists, but control doesn’t.",
    "It’s structured noise, not randomness.",
  ];

  return `Overall, ${country ?? "global"} feels ${tone}. ${
    endings[Math.floor(Math.random() * endings.length)]
  }`;
}

export function buildBriefing(input: BriefingInput) {
  const name = identity(input.userName);

  return {
    opening: opening(name, input.country),
    stories: input.headlines.slice(0, 5).map(story),
    conclusion: conclusion(input.headlines, input.country),
  };
}
