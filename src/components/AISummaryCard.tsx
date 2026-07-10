import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { generateBriefing } from "@/lib/news.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAppState } from "@/hooks/use-app-state";

const CACHE_KEY_PREFIX = "wt:ai-briefing:v2:";
const GUEST_ID_KEY = "wt:guest-id:v1";
const ONE_HOUR_MS = 60 * 60 * 1000;

// Timing constants per animation style
const STAGGER_MS = 90;       // blur / fade / slide — delay between words
const DURATION_MS = 500;     // blur / fade / slide — each word's transition
const TYPEWRITER_MS = 28;    // ms per character
const MATRIX_CHAR_MS = 38;   // ms per character (matrix scramble)
const MATRIX_PASSES = 6;     // scramble passes before settling

export type BriefingAnimation = "blur" | "typewriter" | "fade" | "slide" | "matrix" | "none";

interface CachedBriefing {
  summary: string;
  conclusion: string;
  savedAt: number;
}

interface Props {
  headlines: string[];
  country: string;
  category: string;
  mode: string;
}

/* ---- Cache helpers ---- */
function cacheKeyFor(country: string, category: string, mode: string): string {
  return `${CACHE_KEY_PREFIX}${country}|${category}|${mode}`;
}
function getCache(key: string): CachedBriefing | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBriefing;
    if (Date.now() - parsed.savedAt > ONE_HOUR_MS) return null;
    return parsed;
  } catch { return null; }
}
function setCache(key: string, summary: string, conclusion: string) {
  try {
    localStorage.setItem(key, JSON.stringify({ summary, conclusion, savedAt: Date.now() }));
  } catch {}
}

/* ---- Greeting ---- */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* ---- Guest ID ---- */
function getOrCreateGuestId(): string {
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing) return existing;
    const fresh = `Guest_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    localStorage.setItem(GUEST_ID_KEY, fresh);
    return fresh;
  } catch { return "Guest_0000"; }
}

/* ---- Name resolution ---- */
async function resolveDisplayName(): Promise<{ name: string; isGuest: boolean }> {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      const u = data.user;
      const name =
        (u.user_metadata as any)?.full_name ||
        (u.user_metadata as any)?.name ||
        (u.user_metadata as any)?.username ||
        (u.email ? u.email.split("@")[0] : null) ||
        "there";
      return { name, isGuest: false };
    }
  } catch {}
  return { name: getOrCreateGuestId(), isGuest: true };
}

/* ---- Session cache: prevent replaying animation on back-nav ---- */
const streamedThisSession = new Set<string>();

function splitWords(text: string): string[] {
  return text.match(/\S+\s*/g) || [];
}

/* ============================================================
   ANIMATION HOOKS
   Each hook accepts the full text + a `go` flag (false = hold)
   and returns whatever is needed for rendering.
   ============================================================ */

/** blur-to-focus: existing behaviour, unchanged */
function useBlurAnim(words: string[], go: boolean) {
  return { words, go };
}

/** typewriter: reveal characters one by one */
function useTypewriterAnim(text: string, go: boolean) {
  const [displayed, setDisplayed] = useState("");
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!go) { setDisplayed(text); return; }
    setDisplayed("");
    let i = 0;
    function tick() {
      i++;
      setDisplayed(text.slice(0, i));
      if (i < text.length) rafRef.current = setTimeout(tick, TYPEWRITER_MS);
    }
    rafRef.current = setTimeout(tick, TYPEWRITER_MS);
    return () => { if (rafRef.current) clearTimeout(rafRef.current); };
  }, [text, go]);

  return displayed;
}

/** fade: words fade in sequentially — same structure as blur but different keyframe */
function useFadeAnim(words: string[], go: boolean) {
  return { words, go };
}

/** slide-up: words slide up from below */
function useSlideAnim(words: string[], go: boolean) {
  return { words, go };
}

/** matrix: characters scramble through random chars before settling */
function useMatrixAnim(text: string, go: boolean) {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&";
  const [displayed, setDisplayed] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!go) { setDisplayed(text); return; }
    setDisplayed("");
    const chars = text.split("");
    const settled = new Array(chars.length).fill(false);
    let pass = 0;
    const totalPasses = chars.length * MATRIX_PASSES;

    function tick() {
      pass++;
      // Each pass settles approximately 1/MATRIX_PASSES of remaining chars
      const newSettled = Math.floor(pass / MATRIX_PASSES);
      for (let i = 0; i < newSettled && i < chars.length; i++) {
        settled[i] = true;
      }

      const result = chars.map((ch, i) => {
        if (settled[i] || ch === " ") return ch;
        // Spaces and punctuation pass through immediately
        if (/\s/.test(ch)) return ch;
        return CHARS[Math.floor(Math.random() * CHARS.length)];
      });

      setDisplayed(result.join(""));
      if (pass < totalPasses) {
        timerRef.current = setTimeout(tick, MATRIX_CHAR_MS);
      } else {
        setDisplayed(text);
      }
    }

    timerRef.current = setTimeout(tick, MATRIX_CHAR_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, go]);

  return displayed;
}

/* ============================================================
   ANIMATED TEXT: renders both paragraphs with chosen effect
   ============================================================ */
function AnimatedText({
  summary,
  conclusion,
  animStyle,
  shouldAnimate,
}: {
  summary: string;
  conclusion: string;
  animStyle: BriefingAnimation;
  shouldAnimate: boolean;
}) {
  const go = shouldAnimate && animStyle !== "none";
  const fullText = summary + (conclusion ? "\n\n" + conclusion : "");

  // Typewriter and matrix operate on the full concatenated string,
  // then we split back at the \n\n boundary for layout.
  const twFull = useTypewriterAnim(
    fullText,
    go && animStyle === "typewriter"
  );
  const matFull = useMatrixAnim(
    fullText,
    go && animStyle === "matrix"
  );

  const summaryWords = splitWords(summary);
  const conclusionWords = splitWords(conclusion);
  const summaryWordCount = summaryWords.length;

  /* ---------- helpers ---------- */
  function wordSpans(
    words: string[],
    offset: number,
    keyPrefix: string,
    className: string,
    extraStyle?: (i: number) => React.CSSProperties
  ) {
    return words.map((w, i) => (
      <span
        key={`${keyPrefix}-${i}`}
        className={go ? className : undefined}
        style={go && extraStyle ? extraStyle(offset + i) : undefined}
      >
        {w}
      </span>
    ));
  }

  /* ---------- none / static ---------- */
  if (animStyle === "none" || !shouldAnimate) {
    return (
      <div className="mt-2 space-y-3">
        <p className="text-sm leading-relaxed text-foreground">{summary}</p>
        {conclusion && (
          <p className="text-sm leading-relaxed text-foreground">{conclusion}</p>
        )}
      </div>
    );
  }

  /* ---------- typewriter ---------- */
  if (animStyle === "typewriter") {
    const [twSummary, twConclusion] = twFull.split("\n\n");
    return (
      <div className="mt-2 space-y-3">
        <p className="text-sm leading-relaxed text-foreground font-mono">
          {twSummary ?? ""}
          {(twSummary?.length ?? 0) < summary.length && (
            <span className="animate-pulse text-primary">|</span>
          )}
        </p>
        {conclusion && (
          <p className="text-sm leading-relaxed text-foreground font-mono">
            {twConclusion ?? ""}
            {twConclusion !== undefined && twConclusion.length < conclusion.length && (
              <span className="animate-pulse text-primary">|</span>
            )}
          </p>
        )}
      </div>
    );
  }

  /* ---------- matrix ---------- */
  if (animStyle === "matrix") {
    const [matSummary, matConclusion] = matFull.split("\n\n");
    return (
      <>
        <div className="mt-2 space-y-3">
          <p className="text-sm leading-relaxed text-foreground font-mono tracking-wide text-green-400">
            {matSummary ?? ""}
          </p>
          {conclusion && (
            <p className="text-sm leading-relaxed text-foreground font-mono tracking-wide text-green-400">
              {matConclusion ?? ""}
            </p>
          )}
        </div>
        <style>{`
          @keyframes wt-matrix-flicker {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}</style>
      </>
    );
  }

  /* ---------- blur ---------- */
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
            from { opacity: 0; filter: blur(6px); transform: translateY(2px); }
            to   { opacity: 1; filter: blur(0);   transform: translateY(0); }
          }
          .wt-blur-word {
            display: inline-block; white-space: pre;
            animation: wt-blur-in ${DURATION_MS}ms ease-out both;
          }
        `}</style>
      </>
    );
  }

  /* ---------- fade ---------- */
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
            display: inline-block; white-space: pre;
            animation: wt-fade-in ${DURATION_MS}ms ease-out both;
          }
        `}</style>
      </>
    );
  }

  /* ---------- slide-up ---------- */
  if (animStyle === "slide") {
    return (
      <>
        <div className="mt-2 space-y-3">
          <p className="text-sm leading-relaxed text-foreground overflow-hidden">
            {wordSpans(summaryWords, 0, "s", "wt-slide-word",
              (i) => ({ animationDelay: `${i * STAGGER_MS}ms` }))}
          </p>
          {conclusionWords.length > 0 && (
            <p className="text-sm leading-relaxed text-foreground overflow-hidden">
              {wordSpans(conclusionWords, summaryWordCount, "c", "wt-slide-word",
                (i) => ({ animationDelay: `${i * STAGGER_MS}ms` }))}
            </p>
          )}
        </div>
        <style>{`
          @keyframes wt-slide-up {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .wt-slide-word {
            display: inline-block; white-space: pre;
            animation: wt-slide-up ${DURATION_MS}ms ease-out both;
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
  const animStyle: BriefingAnimation =
    (state.briefingAnimation as BriefingAnimation) ?? "blur";

  const [greetingName, setGreetingName] = useState("there");
  const [isGuest, setIsGuest] = useState(true);
  const [summary, setSummary] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");
  const [shouldAnimate, setShouldAnimate] = useState(true);

  const firstRevealDoneRef = useRef(false);

  function decideAnimate(s: string, c: string): boolean | null {
    if (firstRevealDoneRef.current) return null;
    firstRevealDoneRef.current = true;
    const key = `${s}\u0000${c}`;
    if (streamedThisSession.has(key)) return false;
    streamedThisSession.add(key);
    return true;
  }

  useEffect(() => {
    let alive = true;
    firstRevealDoneRef.current = false;

    async function load() {
      const key = cacheKeyFor(country, category, mode);
      const cached = getCache(key);

      if (cached && alive) {
        const anim = decideAnimate(cached.summary, cached.conclusion);
        if (anim !== null) setShouldAnimate(anim);
        setSummary(cached.summary);
        setConclusion(cached.conclusion);
        setStatus("ready");
      } else if (alive) {
        setStatus("loading");
      }

      const { name, isGuest: guestFlag } = await resolveDisplayName();
      if (!alive) return;
      setGreetingName(name);
      setIsGuest(guestFlag);

      const res = await generateBriefing({ country, category, mode, headlines });
      if (!alive) return;

      if (typeof res?.summary === "string" && res.summary.trim().length > 0) {
        const anim = decideAnimate(res.summary, res.conclusion || "");
        if (anim !== null) setShouldAnimate(anim);
        setSummary(res.summary);
        setConclusion(res.conclusion || "");
        setCache(key, res.summary, res.conclusion || "");
        setStatus("ready");
      } else if (!cached) {
        setStatus("empty");
      }
    }

    load();
    return () => { alive = false; };
  }, [country, category, mode, headlines.join("|")]);

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
          summary={summary}
          conclusion={conclusion}
          animStyle={animStyle}
          shouldAnimate={shouldAnimate}
        />
      )}

      {isGuest && (
        <button
          type="button"
          onClick={() => { window.location.href = "/auth"; }}
          className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
        >
          Sign in for a personalized briefing
        </button>
      )}
    </div>
  );
}
