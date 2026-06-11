import { createFileRoute } from "@tanstack/react-router";

// Detect visitor country via Cloudflare's edge header. Falls back to null.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export const Route = createFileRoute("/api/geo")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const country =
          request.headers.get("cf-ipcountry") ||
          request.headers.get("x-vercel-ip-country") ||
          request.headers.get("x-country") ||
          null;
        return new Response(
          JSON.stringify({ country: country && country !== "XX" ? country.toUpperCase() : null }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
              ...CORS,
            },
          },
        );
      },
    },
  },
});
