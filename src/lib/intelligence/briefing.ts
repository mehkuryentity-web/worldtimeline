export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
}

/**
 * FINAL ROLE:
 * This module does NOT generate narrative.
 * It only normalizes + enriches input data for AI consumption.
 *
 * It is now compatible with:
 * - Supabase memory feeds
 * - Live API feeds
 * - Hybrid merged feeds
 */

export function buildBriefing(input: BriefingInput) {
  const identity =
    input.userName && input.userName.trim().length > 0
      ? input.userName.trim()
      : "Reader";

  const country =
    input.country && input.country !== "GLOBAL"
      ? input.country
      : "global";

  const headlines = Array.isArray(input.headlines)
    ? input.headlines.filter(Boolean)
    : [];

  // lightweight but useful signal layer
  const signals = {
    totalHeadlines: headlines.length,
    hasContent: headlines.length > 0,
    density:
      headlines.length > 20
        ? "high"
        : headlines.length > 5
        ? "medium"
        : "low",
    urgencyHint:
      headlines.length > 0 && headlines.length <= 5
        ? "focused"
        : "broad",
  };

  return {
    identity,

    context: {
      country,
      ...signals,
    },

    // AI-friendly raw input (important for Gemini / briefing engine)
    payload: {
      headlines,
    },
  };
}
