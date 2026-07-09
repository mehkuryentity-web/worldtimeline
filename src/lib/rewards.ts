// Local rewards & interactions store. Persists in localStorage.
// Will be migrated to Lovable Cloud when backend is enabled.

export type Action =
  | "open_app"
  | "read_article"
  | "like"
  | "dislike"
  | "comment"
  | "share"
  | "submit_breaking"
  | "read_summary";

export const POINTS: Record<Action, number> = {
  open_app: 1,
  read_article: 2,
  read_summary: 3,
  like: 1,
  dislike: 1,
  comment: 5,
  share: 4,
  submit_breaking: 25,
};

const KEY = "wt:state:v1";
const CYCLE_KEY = "wt:cycle:v1";

export interface ArticleState {
  reaction?: "like" | "dislike" | null;
  comments: { id: string; at: string; text: string }[];
}

export interface SavedItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  region: string;
  category: string;
  publishedAt: string;
  image?: string;
  savedAt: string;
}

export interface UserPost {
  id: string;
  title: string;
  summary: string;
  category: string;
  region: string;
  publishedAt: string;
  media?: { type: "image" | "video"; dataUrl: string }[];
}

export interface AppState {
  points: number;
  totalEarned: number;
  actionsByDay: Record<string, number>;
  articles: Record<string, ArticleState>;
  submissions: { id: string; title: string; detail: string; at: string }[];
  history: { id: string; action: Action; at: string; points: number }[];
  saved: Record<string, SavedItem>;
  userPosts: UserPost[];
  country?: string;
  category?: string;
  feedMode?: string;
  customRangeHours?: string;
  customRangeMinutes?: string;
  feedVisibleCount?: number;
}

const empty: AppState = {
  points: 0,
  totalEarned: 0,
  actionsByDay: {},
  articles: {},
  submissions: [],
  history: [],
  saved: {},
  userPosts: [],
};

export function load(): AppState {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return empty;
  }
}

export function save(state: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("wt:state"));
}

export function award(action: Action, state: AppState): AppState {
  const pts = POINTS[action];
  const today = new Date().toISOString().slice(0, 10);
  const next: AppState = {
    ...state,
    points: state.points + pts,
    totalEarned: state.totalEarned + pts,
    actionsByDay: { ...state.actionsByDay, [today]: (state.actionsByDay[today] ?? 0) + 1 },
    history: [
      { id: crypto.randomUUID(), action, at: new Date().toISOString(), points: pts },
      ...state.history,
    ].slice(0, 50),
  };
  save(next);
  return next;
}

// 2-week monetization cycle
export function getCycle() {
  if (typeof window === "undefined") {
    const start = new Date();
    return { start: start.toISOString(), end: new Date(start.getTime() + 14 * 86400_000).toISOString() };
  }
  let raw = localStorage.getItem(CYCLE_KEY);
  if (!raw) {
    const start = new Date();
    const cycle = { start: start.toISOString(), end: new Date(start.getTime() + 14 * 86400_000).toISOString() };
    localStorage.setItem(CYCLE_KEY, JSON.stringify(cycle));
    return cycle;
  }
  let cycle = JSON.parse(raw) as { start: string; end: string };
  if (Date.now() > new Date(cycle.end).getTime()) {
    const start = new Date();
    cycle = { start: start.toISOString(), end: new Date(start.getTime() + 14 * 86400_000).toISOString() };
    localStorage.setItem(CYCLE_KEY, JSON.stringify(cycle));
  }
  return cycle;
}

// Convert points to a dollar estimate for display (placeholder rate).
export function pointsToUSD(points: number): number {
  return Math.round(points * 0.01 * 100) / 100;
}
