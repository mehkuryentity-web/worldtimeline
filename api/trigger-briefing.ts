export default async function handler(req, res) {
  try {
    const response = await fetch(
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

    const data = await response.json();

    return res.status(200).json({
      ok: true,
      data,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
