const KEY = "wt:ai-identity:v1";

const ADJECTIVES = [
  "Atlas Reader",
  "Nova Witness",
  "Signal Drifter",
  "Chronicle Hunter",
  "Feed Wanderer",
  "Orbit Listener",
];

function pick() {
  return ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
}

export function getAIIdentity(username?: string | null) {
  if (typeof window === "undefined") return "Reader";

  const stored = localStorage.getItem(KEY);
  if (stored) return stored;

  const value = username ? username : pick();
  localStorage.setItem(KEY, value);
  return value;
}
