import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { generateBriefing } from "@/lib/news.functions";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY_PREFIX = "wt:ai-briefing:v2:";
const GUEST_ID_KEY = "wt:guest-id:v1";
const ONE_HOUR_MS = 60 * 60 * 1000;

// Blur-to-focus reveal tuning. Backend still returns the full payload in
// one shot — this is purely a frontend render effect (CSS animation),
// no edge function or streaming changes.
const BLUR_STAGGER_MS = 90; // delay between each word starting its reveal
const BLUR_DURATION_MS = 500; // how long each word takes to sharpen/fade in

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

// Tracks briefing text that has already been fully streamed once during
// this browser session (module scope survives component remounts —
// e.g. opening then closing an article — but resets on a hard page reload).
const streamedThisSession = new Set<string>();
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

  // Whether the *current* summary/conclusion should play the blur-to-focus
  // reveal, or just render fully sharp immediately. False whenever this
  // exact text has already been shown once this session (e.g. the user
  // opened an article and came back) — no replaying the animation.
  const [shouldAnimate, setShouldAnimate] = useState<boolean>(true);

  // Guards against a second reveal within the SAME visit: the cache (step 1)
  // and the network response (step 3) can each call setSummary, sometimes
  // with slightly different text if Groq regenerated it. Only the first of
  // those two should ever be allowed to animate.
  const firstRevealDoneRef = useRef(false);

  function decideAnimate(fullSummary: string, fullConclusion: string) {
    if (firstRevealDoneRef.current) return false;
    firstRevealDoneRef.current = true;

    const combinedKey = `${fullSummary}\u0000${fullConclusion}`;
    if (streamedThisSession.has(combinedKey)) return false;
    streamedThisSession.add(combinedKey);
    return true;
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      const key = cacheKeyFor(country, category, mode);

      // STEP 1: instant local cache render (zero wait, if we have it)
      const cached = getCache(key);
      if (cached && alive) {
        setShouldAnimate(decideAnimate(cached.summary, cached.conclusion));
        setSummary(cached.summary);
        setConclusion(cached.conclusion);
        setStatus("ready");
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
        setShouldAnimate(decideAnimate(res.summary, res.conclusion || ""));
        setSummary(res.summary);
        setConclusion(res.conclusion || "");
        setCache(key, res.summary, res.conclusion || "");
        setStatus("ready");
      } else if (!cached) {
        setStatus("empty");
      }
    }

    load();

    return () => {
      alive = false;
    };
    // Re-run whenever the selected combo changes
  }, [country, category, mode, headlines.join("|")]);

  // Word arrays for the blur-reveal render, with a continuous stagger index
  // running from the start of the summary through to the end of the
  // conclusion, so the two paragraphs read as one continuous reveal.
  const summaryWords = splitIntoWords(summary);
  const conclusionWords = splitIntoWords(conclusion);
  const summaryWordCount = summaryWords.length;

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
            {summaryWords.map((word, i) => (
              <span
                key={`s-${i}`}
                className={shouldAnimate ? "wt-blur-word" : undefined}
                style={
                  shouldAnimate
                    ? { animationDelay: `${i * BLUR_STAGGER_MS}ms` }
                    : undefined
                }
              >
                {word}
              </span>
            ))}
          </p>

          {conclusionWords.length > 0 && (
            <p className="text-sm leading-relaxed text-foreground">
              {conclusionWords.map((word, i) => (
                <span
                  key={`c-${i}`}
                  className={shouldAnimate ? "wt-blur-word" : undefined}
                  style={
                    shouldAnimate
                      ? {
                          animationDelay: `${
                            (summaryWordCount + i) * BLUR_STAGGER_MS
                          }ms`,
                        }
                      : undefined
                  }
                >
                  {word}
                </span>
              ))}
            </p>
          )}

          {shouldAnimate && (
            <style>{`
              @keyframes wt-blur-in {
                from {
                  opacity: 0;
                  filter: blur(6px);
                  transform: translateY(2px);
                }
                to {
                  opacity: 1;
                  filter: blur(0);
                  transform: translateY(0);
                }
              }
              .wt-blur-word {
                display: inline-block;
                white-space: pre;
                animation: wt-blur-in ${BLUR_DURATION_MS}ms ease-out both;
              }
            `}</style>
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
