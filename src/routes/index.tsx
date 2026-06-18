const TIME_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "5 min", value: 5 * 60 * 1000 },
  { label: "10 min", value: 10 * 60 * 1000 },
  { label: "30 min", value: 30 * 60 * 1000 },
  { label: "1 hour", value: 60 * 60 * 1000 },
  { label: "24 hours", value: 24 * 60 * 60 * 1000 },
];

function Home() {
  const [category, setCategory] = useState<Category>("Top");
  const [country, setCountryState] = useState("GLOBAL");

  const [refreshMs, setRefreshMs] = useState<number>(0);

  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(0);

  const { state, award, update } = useAppState();

  const countryMeta = findCountry(country);

  const setCountry = (code: string) => {
    setCountryState(code);
    update((s) => ({ ...s, country: code }));
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["news", country, category],
    queryFn: () => fetchNews(category, country),
    refetchInterval: refreshMs > 0 ? refreshMs : false,
    staleTime: refreshMs > 0 ? refreshMs : 0,
  });

  const apiItems = (data?.items ?? []).map((n) => ({
    id: n.id,
    category: normalizeCategory(n.category),
    title: n.title,
    source: n.source,
    region: n.region,
    publishedAt: n.publishedAt,
    summary: n.summary,
    url: n.url,
    image: n.image,
  }));

  const userItems = (state.userPosts ?? []).map((p) => ({
    id: p.id,
    category: normalizeCategory(p.category),
    title: p.title,
    source: "Community",
    region: p.region || "Community",
    publishedAt: p.publishedAt,
    summary: p.summary,
    url: "#",
    image: p.media?.find((m) => m.type === "image")?.dataUrl,
  }));

  const allItems = [...userItems, ...apiItems].sort(
    (a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt)
  );

  const now = Date.now();

  // ONLY APPLY FILTER WHEN SELECTED
  const items =
    refreshMs > 0
      ? allItems.filter(
          (i) => now - +new Date(i.publishedAt) <= refreshMs
        )
      : allItems;

  function setTimeMode(value: number) {
    setRefreshMs(value);
  }

  function applyCustomRange() {
    const total = (customHours * 60 + customMinutes) * 60 * 1000;
    setRefreshMs(total);
  }

  return (
    <div>
      <TopBar />

      <div className="flex gap-2 items-center">
        <select
          value={refreshMs}
          onChange={(e) => setTimeMode(Number(e.target.value))}
        >
          {TIME_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {/* CUSTOM RANGE */}
        <div className="flex gap-1 items-center">
          <input
            type="number"
            placeholder="hrs"
            value={customHours}
            onChange={(e) => setCustomHours(Number(e.target.value))}
            className="w-12"
          />
          <input
            type="number"
            placeholder="min"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(Number(e.target.value))}
            className="w-12"
          />
          <button onClick={applyCustomRange}>Set</button>
        </div>
      </div>

      <CategoryTabs value={category} onChange={setCategory} />

      {items.map((item) => (
        <NewsCard key={item.id} item={item} />
      ))}

      <BottomNav />
    </div>
  );
}
