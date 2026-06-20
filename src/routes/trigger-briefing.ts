import { createServerFn } from "@tanstack/start";

export const triggerBriefing = createServerFn(async () => {
  const res = await fetch(
    "https://fadiusjtmtemxvysodie.supabase.co/functions/v1/generate-briefing",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    }
  );

  const data = await res.json();

  return {
    ok: true,
    data,
  };
});
