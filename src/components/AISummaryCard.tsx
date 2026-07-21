import { useEffect, useMemo, useRef, useState } from "react";
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

/* ---- Session dedup ---- */
const streamedThisSession = new Set<string>();
function splitWords(text: string): string[] { return text.match(/\S+\s*/g) || []; }

/* ============================================================
   TYPEWRITER HOOK
   ============================================================ */
function useTypewriterAnim(text: string, go: boolean) {
  const [displayed, setDisplayed] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!go) { setDisplayed(text); return; }
    setDisplayed("");
    let i = 0;
    function tick() {
      i++;
      setDisplayed(text.slice(0, i));
      if (i < text.length) timerRef.current = setTimeout(tick, TYPEWRITER_MS);
    }
    timerRef.current = setTimeout(tick, TYPEWRITER_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, go]);

  return displayed;
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
   Key insight: this component gets a `animKey` prop so React
   fully unmounts+remounts it when new text arrives, guaranteeing
   CSS animations restart from the beginning rather than being
   skipped because the DOM nodes already existed.
   ============================================================ */
function AnimatedText({
  summary, conclusion, animStyle, shouldAnimate, animKey,
}: {
  summary: string; conclusion: string;
  animStyle: BriefingAnimation; shouldAnimate: boolean;
  animKey: string;
}) {
  const go = shouldAnimate && animStyle !== "none";
  const fullText = summary + (conclusion ? "\n\n" + conclusion : "");

  const twFull = useTypewriterAnim(fullText, go && animStyle === "typewriter");
  const matResult = useMatrixAnim(fullText, go && animStyle === "matrix");
  const matFull = matResult.text;
  const matDone = matResult.done;

  const summaryWords = splitWords(summary);
  const conclusionWords = splitWords(conclusion);
  const summaryWordCount = summaryWords.length;

  function wordSpans(
    words: string[], offset: number, keyPrefix: string,
    cls: string, style: (i: number) => React.CSSProperties
  ) {
    return words.map((w, i) => (
      <span key={`${keyPrefix}-${i}`} className={go ? cls : undefined}
        style={go ? style(offset + i) : undefined}>{w}</span>
    ));
  }

  /* none */
  if (animStyle === "none" || !shouldAnimate) {
    return (
      <div className="mt-2 space-y-3">
        <p className="text-sm leading-relaxed text-foreground">{summary}</p>
        {conclusion && <p className="text-sm leading-relaxed text-foreground">{conclusion}</p>}
      </div>
    );
  }

  /* typewriter — standard app text style throughout, both while typing
     and once finished. No special font/size while streaming: it should
     read the same as every other piece of body text in the app. */
  if (animStyle === "typewriter") {
    const [twSummary, twConclusion] = twFull.split("\n\n");
    return (
      <div className="mt-2 space-y-3">
        <p className="text-sm leading-relaxed text-foreground">
          {twSummary ?? ""}
          {(twSummary?.length ?? 0) < summary.length && (
            <span className="animate-pulse text-primary">|</span>
          )}
        </p>
        {conclusion && (
          <p className="text-sm leading-relaxed text-foreground">
            {twConclusion ?? ""}
            {twConclusion !== undefined && twConclusion.length < conclusion.length && (
              <span className="animate-pulse text-primary">|</span>
            )}
          </p>
        )}
      </div>
    );
  }

  /* matrix */
  if (animStyle === "matrix") {
    const [matSummary, matConclusion] = matFull.split("\n\n");
    const matrixCls = matDone
      ? "text-sm leading-relaxed text-foreground"
      : "text-sm leading-relaxed font-mono tracking-wide";
    const matrixStyle = matDone ? undefined : { color: "#ffffff" };
    return (
      <div className="mt-2 space-y-3">
        <p className={matrixCls} style={matrixStyle}>
          {matSummary ?? ""}
        </p>
        {conclusion && (
          <p className={matrixCls} style={matrixStyle}>
            {matConclusion ?? ""}
          </p>
        )}
      </div>
    );
  }

  /* blur */
  if (animStyle === "blur") {
    return (
      <>
        <div className="mt-2 space-y-3">
          <p className="text-sm leading-relaxed text-foreground">
            {wordSpans(summaryWords, 0, "s", "wt-blur-word",
              (i) => ({ animationDelay: `${i * STAGGER_MS}ms` }))}
          </p>
          {conclusionWords.length > 0 && (
            <p className="text-sm leading-relaxed text-foreground">
              {wordSpans(conclusionWords, summaryWordCount, "c", "wt-blur-word",
                (i) => ({ animationDelay: `${i * STAGGER_MS}ms` }))}
            </p>
          )}
        </div>
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
        <div className="mt-2 space-y-3">
          <p className="text-sm leading-relaxed text-foreground">
            {wordSpans(summaryWords, 0, "s", "wt-fade-word",
              (i) => ({ animationDelay: `${i * STAGGER_MS}ms` }))}
          </p>
          {conclusionWords.length > 0 && (
            <p className="text-sm leading-relaxed text-foreground">
              {wordSpans(conclusionWords, summaryWordCount, "c", "wt-fade-word",
                (i) => ({ animationDelay: `${i * STAGGER_MS}ms` }))}
            </p>
          )}
        </div>
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
        <div className="mt-2 space-y-3">
          <p className="text-sm leading-relaxed text-foreground" style={{ overflow: "hidden" }}>
            {wordSpans(summaryWords, 0, "s", "wt-slide-word",
              (i) => ({ animationDelay: `${i * STAGGER_MS}ms` }))}
          </p>
          {conclusionWords.length > 0 && (
            <p className="text-sm leading-relaxed text-foreground" style={{ overflow: "hidden" }}>
              {wordSpans(conclusionWords, summaryWordCount, "c", "wt-slide-word",
                (i) => ({ animationDelay: `${i * STAGGER_MS}ms` }))}
            </p>
          )}
        </div>
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
  // Default is now "typewriter" (was "matrix").
  const animStyle: BriefingAnimation = (state.briefingAnimation as BriefingAnimation) ?? "typewriter";

  const [greetingName, setGreetingName] = useState("there");
  const [isGuest, setIsGuest] = useState(true);
  const [summary, setSummary] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");
  const [shouldAnimate, setShouldAnimate] = useState(true);
  // Changes every time genuinely new text arrives — forces AnimatedText to remount
  // so CSS animations always restart cleanly from frame 0.
  const [animKey, setAnimKey] = useState(0);

  function decideAnimate(s: string, c: string): boolean {
    const key = `${s}\u0000${c}`;
    if (streamedThisSession.has(key)) return false;
    streamedThisSession.add(key);
    return true;
  }

  // Order-insensitive signature: a background refetch that returns the
  // same headlines in a different order must NOT be treated as "new" --
  // that was causing the briefing to restart generation mid-stream and
  // waste a full Groq call on nothing.
  const headlineSig = useMemo(() => [...headlines].sort().join("|"), [headlines]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    async function load() {
      const key = cacheKeyFor(country, category, mode);
      const cached = getCache(key);

      if (cached && alive) {
        setShouldAnimate(decideAnimate(cached.summary, cached.conclusion));
        setSummary(cached.summary);
        setConclusion(cached.conclusion);
        setAnimKey((k) => k + 1);
        setStatus("ready");

        const { name, isGuest: guestFlag } = await resolveDisplayName();
        if (alive) {
          setGreetingName(name);
          setIsGuest(guestFlag);
        }

        // A valid, unexpired local cache fully satisfies this view --
        // stop here rather than also re-validating over the network.
        // Previously this always continued on to generateBriefing()
        // regardless, and if the server's copy had drifted at all from
        // the local cache (which happens often given how the shared
        // ai_briefings row can be refreshed by other requests), that
        // produced a second, fully separate animated playback right
        // after the cached one finished. The cache's own ONE_HOUR_MS
        // expiry is already the freshness guarantee -- no need to
        // double-check it here every time.
        return;
      }

      if (alive) setStatus("loading");

      const { name, isGuest: guestFlag } = await resolveDisplayName();
      if (!alive) return;
      setGreetingName(name);
      setIsGuest(guestFlag);

      const res = await generateBriefing(
        { country, category, mode, headlines },
        { signal: controller.signal }
      );
      if (!alive || res.error === "ABORTED") return;

      if (typeof res?.summary === "string" && res.summary.trim().length > 0) {
        setShouldAnimate(decideAnimate(res.summary, res.conclusion || ""));
        setSummary(res.summary);
        setConclusion(res.conclusion || "");
        setCache(key, res.summary, res.conclusion || "");
        setAnimKey((k) => k + 1);
        setStatus("ready");
      } else {
        setStatus("empty");
      }
    }

    load();
    return () => { alive = false; controller.abort(); };
  }, [country, category, mode, headlineSig]);

  return (
    <div className="rounded-xl border border-primary/40 bg-surface-1 p-4 text-foreground glow-primary">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary">
        <Sparkles className="h-3 w-3" />
        AI Briefing
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
        <AnimatedText
          key={animKey}
          summary={summary}
          conclusion={conclusion}
          animStyle={animStyle}
          shouldAnimate={shouldAnimate}
          animKey={animKey}
        />
      )}

      {isGuest && (
        <button type="button" onClick={() => { window.location.href = "/auth"; }}
          className="mt-3 text-xs underline text-muted-foreground hover:text-foreground">
          Sign in for a personalized briefing
        </button>
      )}
    </div>
  );
}
