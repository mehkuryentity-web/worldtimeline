// CATEGORY_MAP: translates WorldTimeline's app-level categories into
// CurrentsAPI's actual category taxonomy. "Top" and "Videos" intentionally
// map to null -- "Top" means "no category filter" (today's general top
// news), and "Videos" is never fetched here at all (the frontend disables
// this call entirely for that tab; the null entry just documents why, in
// case anything change s upstream later).
const CATEGORY_MAP: Record<string, string | null> = {
  Top: null,
  Videos: null,
  Politics: "politics",
  Business: "business",
  Tech: "technology",
  Science: "science",
  Sports: "sports",
  Climate: "environment",
  Health: "health",
  Entertainment: "entertainment",
};

export default async function handler(req, res) {
  try {
    const category = req.query.category || "Top";
    const country = req.query.country || "GLOBAL";

    const apiKey = process.env.NEWS_API_KEY || process.env.CURRENTS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing NEWS_API_KEY",
        items: [],
      });
    }

    // THE FIX: this handler previously never told CurrentsAPI which
    // category was requested -- every tab silently got the same generic
    // top-news mix, just relabeled with whatever category the user had
    // selected. Now it actually passes CurrentsAPI's own category param
    // when there's a real mapping for it.
    const mappedCategory = Object.prototype.hasOwnProperty.call(CATEGORY_MAP, category)
      ? CATEGORY_MAP[category]
      : null;

    const url = new URL("https://api.currentsapi.services/v1/latest-news");
    url.searchParams.set("language", "en");
    url.searchParams.set("apiKey", apiKey);

    if (mappedCategory) {
      url.searchParams.set("category", mappedCategory);
    }

    if (country !== "GLOBAL") {
      url.searchParams.set("country", country.toLowerCase());
    }

    const response = await fetch(url.toString());
    const json = await response.json();

    const items = (json.news || []).map((n, i) => ({
      id: n.id || String(i),
      category,
      title: n.title,
      source: n.author || "source",
      region: country,
      publishedAt: n.published
        ? new Date(n.published).toISOString()
        : new Date().toISOString(),
      summary: n.description || "",
      url: n.url,
      image: n.image,
    }));

    return res.status(200).json({
      ok: true,
      items,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
      items: [],
    });
  }
}
