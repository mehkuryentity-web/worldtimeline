import { createServerFn } from "@tanstack/react-start";

export const generateArticleSummary = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      id: string;
      title: string;
      summary: string;
      source: string;
      url: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
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
      throw new Error(`AI gateway error ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content?.trim() ?? "";

    const lines = content
      .split(/\r?\n+/)
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter(Boolean);

    return { id: data.id, lines };
  });
