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

    const url = new URL("https://api.currentsapi.services/v1/latest-news");
    url.searchParams.set("language", "en");
    url.searchParams.set("apiKey", apiKey);

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
