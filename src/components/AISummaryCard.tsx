import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { generateBriefing } from "@/lib/news.functions";
import { useAppState } from "@/hooks/use-app-state";
import { useUser } from "@/hooks/use-user";

const CACHE_KEY_PREFIX = "wt:ai-briefing:v2:";
const GUEST_ID_KEY = "wt:guest-id:v1";
const ONE_HOUR_MS = 60 * 60 * 1000;

// Word-stagger animations: delay between each word starting its reveal
const STAGGER_MS = 55;       // 55ms between words — smooth wave across ~200 words ≈ 11s total
const DURATION_MS = 500;     // how long each word's own transition takes

// Typewriter: ms per character
const TYPEWRITER_MS = 22;

// Matrix: total effect target ~3-4 seconds regardless of text length
const MATRIX_TOTAL_MS = 6000;
const MATRIX_TICK_MS = 60;   // repaint interval (~16fps, slower and more dramatic)
const MATRIX_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&!?";

export type BriefingAnimation = "blur" | "typewriter" | "fade" | "slide" | "matrix" | "none";

export interface PinnedArticle {
  title: string; summary: string; url: string; source: string; image: string;
  id: string; category: string; region: string; publishedAt: string; ingestedAt: string;
}

interface CachedBriefing {
  summary: string; conclusion: string; articles: PinnedArticle[];
  // savedAt holds the BACKEND's generated_at (ms since epoch), not the local
  // fetch time -- this is what makes the countdown identical for every user
  // looking at the same country/category/mode, instead of each device
  // running its own independent hour from whenever it happened to load.
  savedAt: number;
}
interface Props {
  headlines: (string | { title: string; summary?: string })[];
  country: string; category: string; mode: string;
  // Bubbles the pinned article set up to the parent feed so it can render
  // the "Covered in this briefing" strip and exclude those articles from
  // resurfacing further down the feed.
  onArticlesLoaded?: (articles: PinnedArticle[]) => void;
}

/* ---- Cache helpers ---- */
function cacheKeyFor(c: string, cat: string, m: string) { return `${CACHE_KEY_PREFIX}${c}|${cat}|${m}`; }
function getCache(key: string): CachedBriefing | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as CachedBriefing;
    return Date.now() - p.savedAt > ONE_HOUR_MS ? null : p;
  } catch { return null; }
}
function setCache(key: string, summary: string, conclusion: string, articles: PinnedArticle[], generatedAtMs: number) {
  try {
    localStorage.setItem(key, JSON.stringify({ summary, conclusion, articles, savedAt: generatedAtMs }));
  } catch {}
}

/* ---- Greeting / guest ---- */
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
function getOrCreateGuestId() {
  try {
    const e = localStorage.getItem(GUEST_ID_KEY);
    if (e) return e;
    const f = `Guest_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    localStorage.setItem(GUEST_ID_KEY, f);
    return f;
  } catch { return "Guest_0000"; }
}

/* ---- Footer line ---- */
const FOOTER_LINE = "Based on today's top stories...";

/* ---- Refresh countdown ---- */
function formatRefreshLabel(savedAt: number | null): string | null {
  if (savedAt == null) return null;
  const remainingMs = ONE_HOUR_MS - (Date.now() - savedAt);
  if (remainingMs <= 0) return "Refreshing soon";
  const minutes = Math.max(1, Math.round(remainingMs / 60000));
  if (minutes >= 60) return "Refreshes in 1 hour";
  return `Refreshes in ${minutes} min`;
}

/* ---- Session dedup ---- */
const streamedThisSession = new Set<string>();
function splitWords(text: string): string[] { return text.match(/\S+\s*/g) || []; }

/* ============================================================
   TYPEWRITER HOOK
   ============================================================ */
function useTypewriterAnim(text: string, go: boolean) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!go) { setDisplayed(text); setDone(true); return; }
    setDisplayed("");
    setDone(false);
    let i = 0;
    function tick() {
      i++;
      setDisplayed(text.slice(0, i));
      if (i < text.length) {
        timerRef.current = setTimeout(tick, TYPEWRITER_MS);
      } else {
        setDone(true);
      }
    }
    timerRef.current = setTimeout(tick, TYPEWRITER_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, go]);

  return { text: displayed, done };
}

/* ============================================================
   MATRIX HOOK
   Fixed-duration approach: decide how many characters to settle
   per tick based on total text length, so it always finishes in
   ~MATRIX_TOTAL_MS regardless of text length.
   ============================================================ */
function useMatrixAnim(text: string, go: boolean) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDone(false);
    if (!go) { setDisplayed(text); setDone(true); return; }

    const chars = text.split("");
    const nonSpace = chars.filter(c => !/\s/.test(c)).length;
    const totalTicks = Math.round(MATRIX_TOTAL_MS / MATRIX_TICK_MS); // ~87 ticks
    // How many real chars to settle per tick (spread evenly)
    const settlePerTick = Math.max(1, Math.ceil(nonSpace / totalTicks));

    let settled = 0; // count of settled non-space chars
    let tick = 0;

    function frame() {
      tick++;
      // Settle the next batch
      settled = Math.min(nonSpace, settled + settlePerTick);

      let nonSpaceSeen = 0;
      const result = chars.map((ch) => {
        if (/\s/.test(ch)) return ch;
        nonSpaceSeen++;
        if (nonSpaceSeen <= settled) return ch; // already settled
        return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
      });

      setDisplayed(result.join(""));

      if (settled < nonSpace) {
        timerRef.current = setTimeout(frame, MATRIX_TICK_MS);
      } else {
        setDisplayed(text);
        setDone(true);
      }
    }

    setDisplayed(chars.map(ch => /\s/.test(ch) ? ch : MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]).join(""));
    timerRef.current = setTimeout(frame, MATRIX_TICK_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, go]);

  return { text: displayed, done };
}

/* ============================================================
   ANIMATED TEXT
   Renders summary + conclusion merged into a single paragraph.
   Key insight: this component gets a `animKey` prop so React
   fully unmounts+remounts it when new text arrives, guaranteeing
   CSS animations restart from the beginning rather than being
   skipped because the DOM nodes already existed.
   ============================================================ */
function AnimatedText({
  text, animStyle, shouldAnimate, onComplete,
}: {
  text: string;
  animStyle: BriefingAnimation; shouldAnimate: boolean;
  onComplete: () => void;
}) {
  const go = shouldAnimate && animStyle !== "none";
  const calledCompleteRef = useRef(false);

  const tw = useTypewriterAnim(text, go && animStyle === "typewriter");
  const mat = useMatrixAnim(text, go && animStyle === "matrix");

  const words = splitWords(text);

  // Fire onComplete exactly once per mount, whenever this style's "done" condition is met.
  useEffect(() => {
    calledCompleteRef.current = false;
  }, [text, animStyle, shouldAnimate]);

  function fireCompleteOnce() {
    if (!calledCompleteRef.current) {
      calledCompleteRef.current = true;
      onComplete();
    }
  }

  useEffect(() => {
    if (animStyle === "typewriter" && tw.done) fireCompleteOnce();
  }, [animStyle, tw.done]);

  useEffect(() => {
    if (animStyle === "matrix" && mat.done) fireCompleteOnce();
  }, [animStyle, mat.done]);

  useEffect(() => {
    if (animStyle === "none" || !shouldAnimate) {
      fireCompleteOnce();
    }
  }, [animStyle, shouldAnimate]);

  // blur / fade / slide: complete after the last word's stagger + its own transition duration
  useEffect(() => {
    if (go && (animStyle === "blur" || animStyle === "fade" || animStyle === "slide")) {
      const totalMs = Math.max(0, words.length - 1) * STAGGER_MS + DURATION_MS;
      const t = setTimeout(fireCompleteOnce, totalMs);
      return () => clearTimeout(t);
    }
  }, [go, animStyle, words.length]);

  function wordSpans(cls: string) {
    return words.map((w, i) => (
      <span key={i} className={go ? cls : undefined}
        style={go ? { animationDelay: `${i * STAGGER_MS}ms` } : undefined}>{w}</span>
    ));
  }

  /* none */
  if (animStyle === "none" || !shouldAnimate) {
    return <p className="text-sm leading-relaxed text-foreground">{text}</p>;
  }

  /* typewriter */
  if (animStyle === "typewriter") {
    return (
      <p className="text-sm leading-relaxed text-foreground">
        {tw.text}
        {!tw.done && <span className="animate-pulse text-primary">|</span>}
      </p>
    );
  }

  /* matrix */
  if (animStyle === "matrix") {
    return <p className="text-sm leading-relaxed text-foreground">{mat.text}</p>;
  }

  /* blur */
  if (animStyle === "blur") {
    return (
      <>
        <p className="text-sm leading-relaxed text-foreground">{wordSpans("wt-blur-word")}</p>
        <style>{`
          @keyframes wt-blur-in {
            from { opacity: 0; filter: blur(8px); transform: translateY(3px); }
            to   { opacity: 1; filter: blur(0);   transform: translateY(0); }
          }
          .wt-blur-word {
            display: inline-block; white-space: pre; opacity: 0;
            animation: wt-blur-in ${DURATION_MS}ms ease-out forwards;
          }
        `}</style>
      </>
    );
  }

  /* fade */
  if (animStyle === "fade") {
    return (
      <>
        <p className="text-sm leading-relaxed text-foreground">{wordSpans("wt-fade-word")}</p>
        <style>{`
          @keyframes wt-fade-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          .wt-fade-word {
            display: inline-block; white-space: pre; opacity: 0;
            animation: wt-fade-in ${DURATION_MS}ms ease-out forwards;
          }
        `}</style>
      </>
    );
  }

  /* slide */
  if (animStyle === "slide") {
    return (
      <>
        <p className="text-sm leading-relaxed text-foreground" style={{ overflow: "hidden" }}>
          {wordSpans("wt-slide-word")}
        </p>
        <style>{`
          @keyframes wt-slide-up {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .wt-slide-word {
            display: inline-block; white-space: pre; opacity: 0;
            animation: wt-slide-up ${DURATION_MS}ms ease-out forwards;
          }
        `}</style>
      </>
    );
  }

  return null;
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export function AISummaryCard({ headlines, country, category, mode, onArticlesLoaded }: Props) {
  const { state } = useAppState();
  const animStyle: BriefingAnimation = (state.briefingAnimation as BriefingAnimation) ?? "fade";

  const { user } = useUser();
  const greetingName = user
    ? ((user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name ||
        (user.user_metadata as any)?.username || (user.email ? user.email.split("@")[0] : null) || "there")
    : getOrCreateGuestId();
  const isGuest = !user;
  const [summary, setSummary] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");
  const [shouldAnimate, setShouldAnimate] = useState(true);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [refreshLabel, setRefreshLabel] = useState<string | null>(null);
  // Changes every time genuinely new text arrives — forces AnimatedText to remount
  // so CSS animations always restart cleanly from frame 0.
  const [animKey, setAnimKey] = useState(0);

  function decideAnimate(s: string, c: string): boolean {
    const key = `${s}\u0000${c}`;
    if (streamedThisSession.has(key)) return false;
    streamedThisSession.add(key);
    return true;
  }

  // Briefing load — cache first, fetch only when cache is missing/expired.
  // NOTE: this effect also self-schedules its own re-run once the cache TTL
  // elapses, so the card actually refreshes while it sits mounted on screen —
  // it no longer depends on the user changing tabs/props to notice expiry.
  useEffect(() => {
    let alive = true;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    setAnimationComplete(false);

    function scheduleAutoRefresh(fromSavedAt: number) {
      if (refreshTimer) clearTimeout(refreshTimer);
      const msUntilExpiry = ONE_HOUR_MS - (Date.now() - fromSavedAt);
      // Fire slightly after the TTL boundary (1s buffer) so getCache() has
      // already invalidated the entry by the time we re-check it.
      const delay = Math.max(1000, msUntilExpiry + 1000);
      refreshTimer = setTimeout(() => {
        if (alive) load();
      }, delay);
    }

    async function load() {
      const key = cacheKeyFor(country, category, mode);
      const cached = getCache(key);

      if (cached && alive) {
        setShouldAnimate(decideAnimate(cached.summary, cached.conclusion));
        setSummary(cached.summary);
        setConclusion(cached.conclusion);
        setSavedAt(cached.savedAt);
        setAnimKey((k) => k + 1);
        setStatus("ready");
        onArticlesLoaded?.(cached.articles || []);
        scheduleAutoRefresh(cached.savedAt);
        return; // valid cache hit — skip the network call entirely
      }

      // No valid local cache. If we don't have real headlines yet (e.g. this
      // is the very first mount, before the news query for this country/
      // category has resolved), do NOT call the backend with an empty array.
      // The server's empty-headlines path just echoes back whatever brief it
      // last generated -- possibly days/weeks old -- tagged stale:true. That
      // used to get cached below as if it were a normal fresh result, which
      // reset the local TTL to "now" while showing old content -- blocking
      // any real refresh for the next hour on every single visit. That's
      // what was leaving some countries/categories stuck on an old brief
      // indefinitely. Just wait for real headlines instead.
      if (!headlines.length) {
        setStatus("loading");
        refreshTimer = setTimeout(() => { if (alive) load(); }, 15000);
        return;
      }

      setStatus("loading");

      const res = await generateBriefing({ country, category, mode, headlines });
      if (!alive) return;

      const hasText = typeof res?.summary === "string" && res.summary.trim().length > 0;

      if (res?.stale) {
        // Server had nothing fresh to give us. Show it so the card isn't
        // blank, but do NOT write it to cache or treat it as a completed
        // refresh -- retry again soon instead of scheduling a full hour out.
        if (hasText) {
          const generatedAtMs = res.generated_at ? new Date(res.generated_at).getTime() : null;
          const articles: PinnedArticle[] = Array.isArray(res.articles) ? res.articles : [];
          setShouldAnimate(decideAnimate(res.summary, res.conclusion || ""));
          setSummary(res.summary);
          setConclusion(res.conclusion || "");
          setSavedAt(generatedAtMs);
          setAnimKey((k) => k + 1);
          setStatus("ready");
          onArticlesLoaded?.(articles);
        } else {
          setStatus("empty");
          onArticlesLoaded?.([]);
        }
        refreshTimer = setTimeout(() => { if (alive) load(); }, 120000);
        return;
      }

      if (hasText) {
        // Prefer the backend's generated_at (shared/synced across every user
        // looking at this same view) -- only fall back to local time if the
        // response is missing it for some reason.
        const generatedAtMs = res.generated_at ? new Date(res.generated_at).getTime() : Date.now();
        const articles: PinnedArticle[] = Array.isArray(res.articles) ? res.articles : [];
        setShouldAnimate(decideAnimate(res.summary, res.conclusion || ""));
        setSummary(res.summary);
        setConclusion(res.conclusion || "");
        setCache(key, res.summary, res.conclusion || "", articles, generatedAtMs);
        setSavedAt(generatedAtMs);
        setAnimKey((k) => k + 1);
        setStatus("ready");
        onArticlesLoaded?.(articles);
        scheduleAutoRefresh(generatedAtMs);
      } else {
        setStatus("empty");
        onArticlesLoaded?.([]);
      }
    }

    load();
    return () => { alive = false; if (refreshTimer) clearTimeout(refreshTimer); };
  }, [country, category, mode, headlines.join("|")]);

  // Live "refreshes in X min" countdown — ticks every 60s, resets when savedAt changes.
  // (Purely cosmetic label now — the actual refetch is handled by the effect above.)
  useEffect(() => {
    setRefreshLabel(formatRefreshLabel(savedAt));
    if (savedAt == null) return;
    const interval = setInterval(() => {
      setRefreshLabel(formatRefreshLabel(savedAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [savedAt]);

  const mergedText = summary + (conclusion ? " " + conclusion : "");
  const showFooter = status === "ready" && animationComplete;

  return (
    <div className="rounded-xl border border-primary/40 bg-surface-1 p-4 text-foreground glow-primary">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
          <Sparkles className="h-3 w-3" />
          AI Briefing
        </div>
        {refreshLabel && status === "ready" && (
          <span className="text-[10px] text-muted-foreground/60">{refreshLabel}</span>
        )}
      </div>

      <p className="mt-2 text-sm leading-relaxed text-foreground">
        {getGreeting()} {greetingName},
      </p>

      {status === "loading" && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Preparing your briefing...
        </p>
      )}
      {status === "empty" && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          No briefing available for this selection yet.
        </p>
      )}
      {status === "ready" && (
        <div className="mt-2 space-y-3">
          <AnimatedText
            key={animKey}
            text={mergedText}
            animStyle={animStyle}
            shouldAnimate={shouldAnimate}
            onComplete={() => setAnimationComplete(true)}
          />
          {showFooter && (
            <p className="text-xs italic text-muted-foreground/70">{FOOTER_LINE}</p>
          )}
        </div>
      )}
    </div>
  );
}
