import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { generateBriefing } from "@/lib/news.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAppState } from "@/hooks/use-app-state";

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

interface CachedBriefing { summary: string; conclusion: string; savedAt: number; }
interface Props { headlines: string[]; country: string; category: string; mode: string; }

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
function setCache(key: string, summary: string, conclusion: string) {
  try { localStorage.setItem(key, JSON.stringify({ summary, conclusion, savedAt: Date.now() })); } catch {}
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
async function resolveDisplayName(): Promise<{ name: string; isGuest: boolean }> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      const u = data.user;
      const name = (u.user_metadata as any)?.full_name || (u.user_metadata as any)?.name ||
        (u.user_metadata as any)?.username || (u.email ? u.email.split("@")[0] : null) || "there";
      return { name, isGuest: false };
    }
  } catch {}
  return { name: getOrCreateGuestId(), isGuest: true };
}

/* ---- Footer line ---- */
function buildFooterLine(country: string, category: string): string {
  const isTop = category === "Top";
  if (isTop) {
    const location = country === "Global" ? "the world" : country;
    return `This is a brief of top happenings across ${location}. Stories will evolve over time.`;
  }
  return `This is a brief of top ${category.toLowerCase()} happenings. Stories will evolve over time.`;
}

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
export function AISummaryCard({ headlines, country, category, mode }: Props) {
  const { state } = useAppState();
  const animStyle: BriefingAnimation = (state.briefingAnimation as BriefingAnimation) ?? "matrix";

  const [greetingName, setGreetingName] = useState("there");
  const [isGuest, setIsGuest] = useState(true);
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

  // Resolve display name once on mount — fully decoupled from the
  // briefing load cycle so it never re-flashes on country/category/mode changes.
  useEffect(() => {
    let alive = true;
    (async () => {
      const { name, isGuest: guestFlag } = await resolveDisplayName();
      if (!alive) return;
      setGreetingName(name);
      setIsGuest(guestFlag);
    })();
    return () => { alive = false; };
  }, []);

  // Briefing load — cache first, fetch only when cache is missing/expired.
  useEffect(() => {
    let alive = true;
    setAnimationComplete(false);

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
        return; // valid cache hit — skip the network call entirely
      }

      setStatus("loading");

      const res = await generateBriefing({ country, category, mode, headlines });
      if (!alive) return;

      if (typeof res?.summary === "string" && res.summary.trim().length > 0) {
        const now = Date.now();
        setShouldAnimate(decideAnimate(res.summary, res.conclusion || ""));
        setSummary(res.summary);
        setConclusion(res.conclusion || "");
        setCache(key, res.summary, res.conclusion || "");
        setSavedAt(now);
        setAnimKey((k) => k + 1);
        setStatus("ready");
      } else {
        setStatus("empty");
      }
    }

    load();
    return () => { alive = false; };
  }, [country, category, mode, headlines.join("|")]);

  // Live "refreshes in X min" countdown — ticks every 60s, resets when savedAt changes.
  useEffect(() => {
    setRefreshLabel(formatRefreshLabel(savedAt));
    if (savedAt == null) return;
    const interval = setInterval(() => {
      setRefreshLabel(formatRefreshLabel(savedAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [savedAt]);

  const mergedText = summary + (conclusion ? " " + conclusion : "");
  const footerLine = buildFooterLine(country, category);
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
            <p className="text-xs italic text-muted-foreground/70">{footerLine}</p>
          )}
        </div>
      )}
    </div>
  );
}
