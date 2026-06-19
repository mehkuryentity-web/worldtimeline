export async function fetchLiveNews(category: string, country: string) {
  const res = await fetch(
    `/api/news?category=${encodeURIComponent(category)}&country=${encodeURIComponent(country)}`
  );

  const json = await res.json();
  return json?.items ?? [];
}
