// Generates a 10-line friendly recap for a news article via Lovable AI Gateway.
// Used as a fallback when the TanStack server function path is unavailable
// (e.g. when the frontend is deployed to Vercel without LOVABLE_API_KEY).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Body {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = (await req.json()) as Body;
    if (!data?.title) {
      return new Response(JSON.stringify({ error: "Missing title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = [
      "You are a witty news blogger.",
      "Rewrite the given news as a lively, jovial, active-voice summary the reader can enjoy.",
      "Output EXACTLY 10 short standalone sentences, one per line, no numbering, no bullets, no headings.",
      "Every sentence must be strictly about the news itself — concrete facts, people, places, numbers, quotes, consequences.",
      "Do NOT include meta commentary like 'why it matters', 'what to watch', 'context', 'how to read this', source disclaimers, or generic safety notes.",
      "Do NOT invent facts beyond what's in the input; if details are thin, rephrase and elaborate naturally from what's given without fabricating new specifics.",
      "Keep it warm and conversational, like a smart friend recapping the story.",
    ].join(" ");

    const user = [
      `Headline: ${data.title}`,
      `Source: ${data.source}`,
      `URL: ${data.url}`,
      `Source summary: ${data.summary}`,
      "",
      "Write the 10-line blogger summary now.",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: `AI gateway error ${res.status}: ${text.slice(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content?.trim() ?? "";

    const lines = content
      .split(/\r?\n+/)
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter(Boolean);

    return new Response(JSON.stringify({ id: data.id, lines }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
