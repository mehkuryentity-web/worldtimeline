import { useEffect, useState } from "react";
import { generateBriefing } from "@/lib/news.functions";
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "wt:ai-briefing:v1";
const GUEST_ID_KEY = "wt:guest-id:v1";

/* -------------------------
   CACHE HELPERS
--------------------------*/
function getCache(): string | null {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

function setCache(value: string) {
  try {
    localStorage.setItem(CACHE_KEY, value);
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
   BRIEFING TEXT BUILDER
--------------------------*/
function buildBriefingText(name: string, summary: string): string {
  const greeting = `${getGreeting()} ${name},`;
  return `${greeting}\n\n${summary}`;
}

/* -------------------------
   COMPONENT
--------------------------*/
export function AISummaryCard() {
  const [text, setText] = useState<string>(
    () => getCache() || "Preparing your briefing..."
  );
  const [isGuest, setIsGuest] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      // STEP 1: instant cache render (no fetch delay)
      const cached = getCache();
      if (cached) {
        if (alive) setText(cached);
      }

      // STEP 2: resolve who the user is
      const { name, isGuest: guestFlag } = await resolveDisplayName();
      if (!alive) return;
      setIsGuest(guestFlag);

      // STEP 3: fetch Supabase briefing
      const res = await generateBriefing();
      if (!alive) return;

      console.log("RAW_BRIEFING_RESULT:", res);

      const summary = res?.summary;

      if (typeof summary === "string" && summary.trim().length > 0) {
        const finalText = buildBriefingText(name, summary);
        setCache(finalText);
        setText(finalText);
        return;
      }

      // STEP 4: fallback if Supabase briefing genuinely unavailable
      // (only shown if there was no cache AND the fetch failed)
      if (!cached) {
        const fallback = `${getGreeting()} ${name}, your briefing is on its way. Check back in a moment.`;
        setText(fallback);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-black/60 p-4 text-white">
      <div className="text-[10px] uppercase tracking-widest opacity-60">
        AI Briefing
      </div>

      <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
        {text}
      </p>

      {isGuest && (
        <button
          type="button"
          onClick={() => {
            window.location.href = "/login";
          }}
          className="mt-3 text-xs underline opacity-70 hover:opacity-100"
        >
          Sign in for a personalized briefing
        </button>
      )}
    </div>
  );
}
