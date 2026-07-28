// Vercel Edge Middleware
//
// Purpose: link-preview crawlers (WhatsApp, iMessage, Twitter/X, Facebook,
// Slack, Discord, etc.) don't execute client JS -- they just fetch the URL
// and read whatever <meta> tags are in the raw HTML response. Since this is
// a client-rendered Vite/TanStack Router SPA, every route normally serves
// the same static index.html with the same generic OG tags, so shared
// article links show a blank/generic preview card instead of the article's
// own title/image/summary.
//
// This middleware only intercepts requests to /article/:id AND only when
// the request looks like it's coming from a known crawler. For everyone
// else (real users opening the link in a browser), it does nothing and the
// normal SPA loads exactly as before.
//
// The article's `id` is its full source URL (get-news mints `id: r.url`),
// so the incoming path segment is that URL, percent-encoded by
// encodeURIComponent() on the client (see ReactionBar.tsx's share()). We
// decode it the same way before querying Supabase.

export const config = {
  matcher: "/article/:id*",
};

// Matches the crawler/bot user-agents for the major link-preview surfaces.
// Deliberately broad -- a false positive here just means a real user with
// an unusual UA gets the lightweight OG shell instead of the SPA, which
// still contains a "click to read" link into the app, so it degrades
// gracefully either way.
const CRAWLER_UA_RE =
  /bot|facebookexternalhit|Twitterbot|WhatsApp|Slackbot|Discordbot|LinkedInBot|TelegramBot|Pinterest|Applebot|SkypeUriPreview|iMessage|redditbot|vkShare|W3C_Validator/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchArticleMeta(sourceUrl: string) {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_KEY =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  const endpoint = `${SUPABASE_URL}/rest/v1/news_archive?url=eq.${encodeURIComponent(
    sourceUrl
  )}&select=title,summary,image&limit=1`;

  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      title: string;
      summary: string | null;
      image: string | null;
    }>;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function middleware(request: Request) {
  const url = new URL(request.url);
  const userAgent = request.headers.get("user-agent") || "";

  if (!CRAWLER_UA_RE.test(userAgent)) {
    return; // not a crawler -- let the normal SPA response through untouched
  }

  const encodedId = url.pathname.replace(/^\/article\//, "");
  if (!encodedId) return;

  let sourceUrl: string;
  try {
    sourceUrl = decodeURIComponent(encodedId);
  } catch {
    return; // malformed encoding -- fall through to the SPA's own 404 handling
  }

  const article = await fetchArticleMeta(sourceUrl);

  const title = article?.title ? escapeHtml(article.title) : "WorldTimeline";
  const description = article?.summary
    ? escapeHtml(article.summary.slice(0, 200))
    : "Stay on top of the news that matters.";
  const image = article?.image || undefined;
  const pageUrl = url.toString();

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${escapeHtml(pageUrl)}" />
    ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ""}
    <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ""}
  </head>
  <body>
    <a href="${escapeHtml(pageUrl)}">${title}</a>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
