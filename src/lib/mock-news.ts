export type Category =
  | "Top"
  | "Videos"
  | "Politics"
  | "Business"
  | "Tech"
  | "Science"
  | "Sports"
  | "Climate"
  | "Health"
  | "Entertainment";

export const CATEGORIES: Category[] = [
  "Top",
  "Videos",
  "Politics",
  "Business",
  "Tech",
  "Science",
  "Sports",
  "Climate",
  "Health",
  "Entertainment",
];

// ──────────────────────────────────────────────
// Article cache — used so /article/$id detail pages can find the article
// even after the feed unmounts. Persists to localStorage.
const ARTICLE_KEY = "wt:articles:v1";
export function cacheArticles(items: NewsItem[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(ARTICLE_KEY);
    const map: Record<string, NewsItem> = raw ? JSON.parse(raw) : {};
    for (const it of items) map[it.id] = it;
    localStorage.setItem(ARTICLE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
export function getCachedArticle(id: string): NewsItem | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ARTICLE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, NewsItem>;
    return map[id] ?? null;
  } catch {
    return null;
  }
}

export interface NewsItem {
  id: string;
  category: Category;
  title: string;
  source: string;
  region: string;
  publishedAt: string; // ISO
  summary: string;
  url: string;
  breaking?: boolean;
  live?: boolean;
  image?: string;
  timelineId?: string;
}

export interface TimelineEvent {
  id: string;
  at: string;
  title: string;
  detail: string;
}

export interface Timeline {
  id: string;
  title: string;
  events: TimelineEvent[];
}

const now = Date.now();
const minsAgo = (m: number) => new Date(now - m * 60_000).toISOString();

export const TIMELINES: Record<string, Timeline> = {
  "election-2026": {
    id: "election-2026",
    title: "Global Election Cycle 2026",
    events: [
      { id: "e1", at: minsAgo(15), title: "Polls open in three EU states", detail: "Record early turnout reported across France, Germany, and Poland." },
      { id: "e2", at: minsAgo(120), title: "Final debate concludes", detail: "Candidates clash over energy policy and migration." },
      { id: "e3", at: minsAgo(60 * 24), title: "Campaign spending hits new high", detail: "Independent monitors flag $2.1B in cross-border ad spend." },
      { id: "e4", at: minsAgo(60 * 24 * 7), title: "Ballot access dispute resolved", detail: "Supreme court rules in favor of expanded mail-in voting." },
    ],
  },
  "ai-regulation": {
    id: "ai-regulation",
    title: "AI Regulation Worldwide",
    events: [
      { id: "a1", at: minsAgo(8), title: "US Senate advances AI safety bill", detail: "Bipartisan 71-29 vote moves landmark legislation to the House." },
      { id: "a2", at: minsAgo(180), title: "EU AI Act amendments published", detail: "New foundation-model thresholds take effect Q3." },
      { id: "a3", at: minsAgo(60 * 24 * 2), title: "China releases compute export framework", detail: "Sets quarterly review for advanced GPU shipments." },
    ],
  },
  "climate-cop": {
    id: "climate-cop",
    title: "COP Climate Negotiations",
    events: [
      { id: "c1", at: minsAgo(45), title: "Draft text leaks ahead of plenary", detail: "Loss-and-damage fund proposal grows to $400B." },
      { id: "c2", at: minsAgo(60 * 6), title: "India and Brazil announce joint pledge", detail: "Renewables capacity target raised 30% by 2030." },
      { id: "c3", at: minsAgo(60 * 24 * 3), title: "Pre-summit protests in 18 cities", detail: "Youth coalitions demand binding fossil-fuel phase-out." },
    ],
  },
};

export const MOCK_NEWS: NewsItem[] = [
  {
    id: "n1",
    category: "Politics",
    title: "US Senate advances landmark AI safety bill in bipartisan 71–29 vote",
    source: "Reuters",
    region: "Washington, DC",
    publishedAt: minsAgo(8),
    summary:
      "The bill establishes mandatory red-team evaluations for frontier models and creates a federal AI oversight board. Industry groups warn of compliance costs while advocates call the framework long overdue.",
    url: "#",
    breaking: true,
    live: true,
    timelineId: "ai-regulation",
  },
  {
    id: "n2",
    category: "World",
    title: "Polls open across three EU states in pivotal continental election day",
    source: "AFP",
    region: "Brussels",
    publishedAt: minsAgo(15),
    summary:
      "Early turnout exceeds 2022 records in France and Germany. Observers cite economic anxiety and migration as decisive issues for swing constituencies.",
    url: "#",
    live: true,
    timelineId: "election-2026",
  },
  {
    id: "n3",
    category: "Climate",
    title: "COP draft text leaks: loss-and-damage fund expands to $400B proposal",
    source: "The Guardian",
    region: "Geneva",
    publishedAt: minsAgo(45),
    summary:
      "Negotiators briefed on revised draft ahead of tomorrow's plenary. The text includes binding mid-decade emissions checkpoints opposed by major exporters.",
    url: "#",
    timelineId: "climate-cop",
  },
  {
    id: "n4",
    category: "Tech",
    title: "Apple unveils on-device reasoning model with 4x efficiency claim",
    source: "Bloomberg",
    region: "Cupertino",
    publishedAt: minsAgo(70),
    summary:
      "The model runs entirely on M-series silicon and ships in a developer beta next week. Benchmarks suggest parity with cloud models on summarization tasks.",
    url: "#",
  },
  {
    id: "n5",
    category: "Business",
    title: "Yen volatility spikes after surprise BOJ comments on rate path",
    source: "Nikkei",
    region: "Tokyo",
    publishedAt: minsAgo(95),
    summary:
      "Currency traders price in a higher chance of a December hike. Equities pared early losses after the central bank clarified its policy stance.",
    url: "#",
  },
  {
    id: "n6",
    category: "Science",
    title: "JWST detects atmospheric water on cool sub-Neptune 40 light-years away",
    source: "Nature",
    region: "Baltimore",
    publishedAt: minsAgo(140),
    summary:
      "The detection strengthens the case that small, cool exoplanets retain volatile envelopes. Follow-up observations are scheduled for next cycle.",
    url: "#",
  },
  {
    id: "n7",
    category: "Sports",
    title: "Champions League: late stoppage-time winner sends underdogs to quarters",
    source: "ESPN",
    region: "London",
    publishedAt: minsAgo(180),
    summary:
      "A 95th-minute strike completed a remarkable two-leg comeback, setting up a marquee draw next week.",
    url: "#",
  },
  {
    id: "n8",
    category: "Health",
    title: "WHO updates pandemic preparedness benchmarks for member states",
    source: "WHO",
    region: "Geneva",
    publishedAt: minsAgo(220),
    summary:
      "New benchmarks emphasize wastewater surveillance and rapid vaccine manufacturing scale-up clauses.",
    url: "#",
  },
  {
    id: "n9",
    category: "World",
    title: "Mediation talks resume in regional ceasefire, hostage exchange agreed",
    source: "Al Jazeera",
    region: "Doha",
    publishedAt: minsAgo(30),
    summary:
      "Negotiators confirmed a phased framework. Humanitarian convoys are expected to enter within 48 hours under monitoring.",
    url: "#",
    breaking: true,
  },
  {
    id: "n10",
    category: "Tech",
    title: "Major cloud provider reports multi-region outage affecting 14 services",
    source: "The Verge",
    region: "Global",
    publishedAt: minsAgo(22),
    summary:
      "Engineers traced the issue to a faulty configuration push. Recovery is underway with most services partially restored.",
    url: "#",
    breaking: true,
    live: true,
  },
  {
    id: "n11",
    category: "Business",
    title: "Oil dips below $72 as inventory build surprises traders",
    source: "FT",
    region: "New York",
    publishedAt: minsAgo(260),
    summary:
      "Refined product stocks rose for a third straight week. OPEC+ schedule next month is now in focus.",
    url: "#",
  },
  {
    id: "n12",
    category: "Climate",
    title: "Atmospheric river drenches western coast, evacuation orders issued",
    source: "AP",
    region: "California",
    publishedAt: minsAgo(50),
    summary:
      "Rainfall totals approach 8 inches in 24 hours. Officials warn of mudslide risk on recent burn scars.",
    url: "#",
    live: true,
  },
];

export function getInitialSummary(): string {
  return [
    "Markets are mixed as a surprise BOJ comment lifts the yen and oil slips below $72 on a third weekly inventory build.",
    "In Washington, the Senate advanced a bipartisan AI safety bill — the most consequential US tech regulation move this cycle.",
    "Three EU states are voting today; early turnout is breaking 2022 records.",
    "A regional ceasefire framework was agreed in Doha with hostage exchange phased over 48 hours.",
    "On climate, a leaked COP draft expands the loss-and-damage fund proposal to $400B ahead of tomorrow's plenary.",
  ].join(" ");
}
