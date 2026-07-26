// Local rewards & interactions store. Persists in localStorage, and (once
// signed in) syncs to the `user_progress` table -- see the "Account sync"
// section near the bottom of this file.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

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
  feedScrollY?: number;
  briefingAnimation?: string;
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
    const parsed = { ...empty, ...JSON.parse(raw) };

    // Defensively normalize each article entry. Malformed/partial entries
    // (e.g. from an older schema, a failed write, or manual localStorage
    // edits) used to leave `comments` undefined -- spreading that with
    // `...a.comments` in ReactionBar's submitComment threw a TypeError
    // ("a.comments is not iterable"), which crashed the whole page to the
    // generic "This page didn't load" error boundary instead of just
    // failing to post the comment.
    const articles: AppState["articles"] = {};
    for (const [id, entry] of Object.entries(parsed.articles ?? {})) {
      const a = entry as Partial<ArticleState> | null | undefined;
      articles[id] = {
        reaction: a?.reaction ?? null,
        comments: Array.isArray(a?.comments) ? a!.comments : [],
      };
    }

    return { ...parsed, articles };
  } catch {
    return empty;
  }
}

export function save(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    // Quota exceeded (common once `saved` grows large, since each entry
    // carries a full title/summary/image) or storage unavailable (Safari
    // private mode) both throw synchronously here. This call happens inside
    // a setState updater (see useAppState.update), so an uncaught throw
    // doesn't just fail the save -- it aborts the render and gets caught by
    // the root route's errorComponent, i.e. the whole page dies with
    // "This page didn't load". Swallow it instead: the in-memory state (and
    // therefore the UI) still updates via setState, it just won't persist
    // across a reload until something is freed up.
    console.error("Failed to persist app state", err);
  }
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

// ---------------------------------------------------------------------
// Account sync (user_progress table)
//
// `wt:state:v1` above is purely local/per-browser. Everything below
// bridges it to a per-account row in Supabase so progress follows a
// signed-in user across devices, instead of staying stuck on whichever
// device it was earned on. Kept in this file (not a separate module) so
// there's one source of truth for what "app state" means.
// ---------------------------------------------------------------------

// True if the local store has anything worth asking the user about
// before it gets discarded or overwritten.
export function hasMeaningfulProgress(state: AppState): boolean {
  return (
    state.totalEarned > 0 ||
    Object.keys(state.saved).length > 0 ||
    state.history.length > 0 ||
    state.userPosts.length > 0 ||
    state.submissions.length > 0
  );
}

// Wipes local progress back to empty. Used both when a user chooses to
// discard guest progress, and on sign-out -- so the next person on a
// shared device doesn't inherit the previous account's synced data.
export function resetLocal() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent("wt:state"));
}

// Additive merge used when a user opts to keep their guest progress:
// numeric/point history stacks, record maps union (existing account
// data wins on key collisions since it's the more "official" copy).
export function mergeStates(accountState: AppState, guestState: AppState): AppState {
  return {
    ...empty,
    points: accountState.points + guestState.points,
    totalEarned: accountState.totalEarned + guestState.totalEarned,
    actionsByDay: Object.entries(guestState.actionsByDay).reduce(
      (acc, [day, count]) => ({ ...acc, [day]: (acc[day] ?? 0) + count }),
      { ...accountState.actionsByDay }
    ),
    articles: { ...guestState.articles, ...accountState.articles },
    submissions: [...accountState.submissions, ...guestState.submissions],
    history: [...accountState.history, ...guestState.history]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 50),
    saved: { ...guestState.saved, ...accountState.saved },
    userPosts: [...accountState.userPosts, ...guestState.userPosts],
    country: accountState.country ?? guestState.country,
    category: accountState.category ?? guestState.category,
  };
}

// Fetches the signed-in user's cloud progress. Returns null if they've
// never had one saved (brand-new account, or never signed in on any
// device before).
export async function pullRemote(userId: string): Promise<AppState | null> {
  const { data, error } = await supabase
    .from("user_progress")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return { ...empty, ...(data.state as Partial<AppState>) };
}

// Upserts the given state as the signed-in user's cloud progress.
export async function pushRemote(userId: string, state: AppState): Promise<void> {
  await supabase.from("user_progress").upsert({
    user_id: userId,
    state: state as unknown as Json,
    updated_at: new Date().toISOString(),
  });
}
