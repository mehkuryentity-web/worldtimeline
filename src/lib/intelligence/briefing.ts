export function buildBriefing(headlines: string[]) {
  if (!headlines.length) return "";

  return {
    tone:
      "editorial intelligence briefing",
    summary: [
      `${headlines[0]}`,
      `${headlines[1] ?? ""}`,
      `${headlines[2] ?? ""}`,
      `Global narrative forming across politics, markets, and regulation.`,
    ].filter(Boolean),
  };
}
