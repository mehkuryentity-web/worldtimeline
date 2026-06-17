const IDENTITY_KEY = "wt:brief_identity:v1";

const FUN_NAMES = [
  "StoryRaven",
  "GossipNomad",
  "ChronicleFox",
  "NewsWhisper",
  "PlotHopper",
  "RumorSage",
  "ScrollJester",
  "TaleDrifter",
  "IntelPanda",
  "BriefingBandit",
  "LoreSeeker",
  "BuzzAlchemist",
];

function pickRandom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sanitize(name: string) {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")[0]
    .slice(0, 18);
}

/**
 * SINGLE SOURCE OF TRUTH FOR BRIEF IDENTITY
 */
export function getBriefIdentity(userName?: string | null) {
  if (typeof window === "undefined") return "NewsSeeker";

  try {
    const existing = localStorage.getItem(IDENTITY_KEY);
    if (existing) return existing;

    const name = userName?.trim()
      ? sanitize(userName)
      : pickRandom(FUN_NAMES);

    localStorage.setItem(IDENTITY_KEY, name);
    return name;
  } catch {
    return userName || "NewsSeeker";
  }
}

export function resetBriefIdentity() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(IDENTITY_KEY);
}
