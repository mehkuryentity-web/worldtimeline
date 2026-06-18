export interface BriefingInput {
  headlines: string[];
  userName?: string | null;
  country?: string;
}

/**
 * FINAL ROLE:
 * This file no longer generates narrative.
 * It only provides lightweight metadata.
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

  const headlines = input.headlines || [];

  return {
    identity,

    // lightweight context only (NOT narration)
    context: {
      country,
      count: headlines.length,
      hasContent: headlines.length > 0,
    },
  };
}
