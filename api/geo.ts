// Returns the visitor's country as detected by Vercel's edge network.
// Vercel automatically injects x-vercel-ip-country on every request that
// hits its edge (production + preview deployments) -- no external
// IP-geolocation API, no API key, no extra network round-trip on our
// side. Locally (vercel dev / plain vite dev) this header won't be
// present, so country comes back null and the frontend just keeps its
// GLOBAL default -- same behavior as a lookup failure in production.
export default async function handler(req, res) {
  const country = req.headers["x-vercel-ip-country"] || null;
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ country });
}
