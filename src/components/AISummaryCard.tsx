import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { generateBriefing } from "@/lib/news.functions";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY_PREFIX = "wt:ai-briefing:v2:";
const GUEST_ID_KEY = "wt:guest-id:v1";
const ONE_HOUR_MS = 60 * 60 * 1000;

// Simulated-stream tuning: reveal this many words per tick.
// Backend still returns the full payload in one shot — this is
// purely a frontend render effect, no edge function changes.
const STREAM_MS_PER_WORD = 35;
const STREAM_WORDS_PER_TICK = 1;

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

/* -------------------------
   CACHE HELPERS (per combo, local fast-path only —
   the real source of truth is Supabase; this just
   avoids a network round-trip on quick re-renders)
--------------------------*/
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
  } catch {
    return null;
  }
}

function setCache(key: string, summary: string, conclusion: string) {
  try {
    const payload: CachedBriefing = {
      summary,
      conclusion,
      savedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}

/* -------------------------
   TIME GREETING
--------------------------*/
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/* -------------------------
   GUEST ID (persists per device until login)
--------------------------*/
function getOrCreateGuestId(): string {
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing) return existing;

    const fresh = `Guest_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    localStorage.setItem(GUEST_ID_KEY, fresh);
    return fresh;
  } catch {
    return "Guest_0000";
  }
}

/* -------------------------
   NAME RESOLUTION (logged in vs guest)
--------------------------*/
async function resolveDisplayName(): Promise<{
  name: string;
  isGuest: boolean;
}> {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (!error && data?.user) {
      const user = data.user;
      const fromMetadata =
        (user.user_metadata as any)?.full_name ||
        (user.user_metadata as any)?.name ||
        (user.user_metadata as any)?.username;

      const fallbackFromEmail = user.email ? user.email.split("@")[0] : null;
      const name = fromMetadata || fallbackFromEmail || "there";

      return { name, isGuest: false };
    }
  } catch {
    // fall through to guest
  }

  return { name: getOrCreateGuestId(), isGuest: true };
}

/* -------------------------
   SIMULATED STREAM HELPER
   Backend returns the full text in one payload, same as before.
   This just reveals it progressively on the frontend, word by word,
   so it *feels* like a live stream without touching Groq/edge functions.
--------------------------*/
function splitIntoWords(text: string): string[] {
  // Keep trailing whitespace attached to each word so re-joining is lossless
  const matches = text.match(/\S+\s*/g);
  return matches || [];
}

/* -------------------------
   COMPONENT
--------------------------*/
export function AISummaryCard({ headlines, country, category, mode }: Props) {
  const [greetingName, setGreetingName] = useState<string>("there");
  const [isGuest, setIsGuest] = useState<boolean>(true);
  const [summary, setSummary] = useState<string>("");
  const [conclusion, setConclusion] = useState<string>("");
  const [status, setStatus] = useState<"loading" | "ready" | "empty">(
    "loading"
  );

  // What's actually rendered on screen right now (may lag behind `summary`/
  // `conclusion` while the reveal animation is mid-flight).
  const [displayedSummary, setDisplayedSummary] = useState<string>("");
  const [displayedConclusion, setDisplayedConclusion] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState<boolean>(false);

  // Tracks the last text we've already animated, so re-renders with
  // identical content (e.g. cache hit followed by a matching network
  // response) don't replay the typing effect.
  const lastAnimatedRef = useRef<string>("");
  const streamTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopStreaming() {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }

  function revealProgressively(fullSummary: string, fullConclusion: string) {
    const combinedKey = `${fullSummary}\u0000${fullConclusion}`;
    if (combinedKey === lastAnimatedRef.current) {
      // Already showing this exact text — just make sure it's fully rendered.
      setDisplayedSummary(fullSummary);
      setDisplayedConclusion(fullConclusion);
      setIsStreaming(false);
      return;
    }

    stopStreaming();
    lastAnimatedRef.current = combinedKey;

    const summaryWords = splitIntoWords(fullSummary);
    const conclusionWords = splitIntoWords(fullConclusion);
    const totalWords = summaryWords.length + conclusionWords.length;

    if (totalWords === 0) {
      setDisplayedSummary(fullSummary);
      setDisplayedConclusion(fullConclusion);
      setIsStreaming(false);
      return;
    }

    setDisplayedSummary("");
    setDisplayedConclusion("");
    setIsStreaming(true);

    let wordIndex = 0;
    streamTimerRef.current = setInterval(() => {
      wordIndex = Math.min(wordIndex + STREAM_WORDS_PER_TICK, totalWords);

      if (wordIndex <= summaryWords.length) {
        setDisplayedSummary(summaryWords.slice(0, wordIndex).join(""));
      } else {
        setDisplayedSummary(fullSummary);
        setDisplayedConclusion(
          conclusionWords.slice(0, wordIndex - summaryWords.length).join("")
        );
      }

      if (wordIndex >= totalWords) {
        stopStreaming();
        setIsStreaming(false);
        setDisplayedSummary(fullSummary);
        setDisplayedConclusion(fullConclusion);
      }
    }, STREAM_MS_PER_WORD);
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      const key = cacheKeyFor(country, category, mode);

      // STEP 1: instant local cache render (zero wait, if we have it)
      const cached = getCache(key);
      if (cached && alive) {
        setSummary(cached.summary);
        setConclusion(cached.conclusion);
        setStatus("ready");
        revealProgressively(cached.summary, cached.conclusion);
      } else if (alive) {
        setStatus("loading");
      }

      // STEP 2: resolve who the user is (runs in parallel, doesn't block text)
      const { name, isGuest: guestFlag } = await resolveDisplayName();
      if (!alive) return;
      setGreetingName(name);
      setIsGuest(guestFlag);

      // STEP 3: ask backend (Supabase decides: serve cached or generate)
      const res = await generateBriefing({ country, category, mode, headlines });
      if (!alive) return;

      if (typeof res?.summary === "string" && res.summary.trim().length > 0) {
        setSummary(res.summary);
        setConclusion(res.conclusion || "");
        setCache(key, res.summary, res.conclusion || "");
        setStatus("ready");
        revealProgressively(res.summary, res.conclusion || "");
      } else if (!cached) {
        setStatus("empty");
      }
    }

    load();

    return () => {
      alive = false;
      stopStreaming();
    };
    // Re-run whenever the selected combo changes
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
        <div className="mt-2 space-y-3">
          <p className="text-sm leading-relaxed text-foreground">
            {displayedSummary}
            {isStreaming && displayedConclusion === "" && (
              <span className="ml-0.5 animate-pulse text-primary">▍</span>
            )}
          </p>

          {displayedConclusion && (
            <p className="text-sm leading-relaxed text-foreground">
              {displayedConclusion}
              {isStreaming && (
                <span className="ml-0.5 animate-pulse text-primary">▍</span>
              )}
            </p>
          )}
        </div>
      )}

      {isGuest && (
        <button
          type="button"
          onClick={() => {
            window.location.href = "/login";
          }}
          className="mt-3 text-xs underline text-muted-foreground hover:text-foreground"
        >
          Sign in for a personalized briefing
        </button>
      )}
    </div>
  );
}
