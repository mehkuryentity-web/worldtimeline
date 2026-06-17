const IDENTITY_KEY = "wt:ai-identity:v1";

const fantasyNames = [
  "Nova Quill",
  "Mira Chronicle",
  "Jade Epoch",
  "Lyra Broadcast",
  "Orion Pulse",
  "Sage Ticker",
  "Vera Insight",
  "Nia Ledger",
  "Aria Scope",
  "Zuri Intel",
];

function randomName() {
  return fantasyNames[Math.floor(Math.random() * fantasyNames.length)];
}

export function getAIIdentity(): string {
  if (typeof window === "undefined") return "Guest Reader";

  try {
    const existing = localStorage.getItem(IDENTITY_KEY);
    if (existing) return existing;

    const generated = randomName();
    localStorage.setItem(IDENTITY_KEY, generated);
    return generated;
  } catch {
    return "Guest Reader";
  }
}

export function resetAIIdentity() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(IDENTITY_KEY);
}
