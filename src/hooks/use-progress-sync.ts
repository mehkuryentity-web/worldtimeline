import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  load,
  resetLocal,
  hasMeaningfulProgress,
  mergeStates,
  pullRemote,
  pushRemote,
  type AppState,
} from "@/lib/rewards";

const PUSH_DEBOUNCE_MS = 2000;

export type PendingChoice = {
  guestState: AppState;
  accountState: AppState | null;
} | null;

/**
 * Mount this once, app-wide (see __root.tsx). It doesn't replace
 * useAppState -- components keep reading/writing local state exactly as
 * before via `wt:state` events. This hook only handles the boundary:
 * what happens to that local state when someone signs in or out.
 */
export function useProgressSync() {
  const [pending, setPending] = useState<PendingChoice>(null);
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      const userId = session?.user?.id ?? null;

      if (event === "SIGNED_OUT" || (currentUserId.current && !userId)) {
        // Shared-device privacy: don't leave a signed-out account's
        // synced progress sitting in local storage for the next person.
        resetLocal();
        currentUserId.current = null;
        return;
      }

      if (userId && userId !== currentUserId.current) {
        currentUserId.current = userId;
        const guestState = load();
        const accountState = await pullRemote(userId);

        if (hasMeaningfulProgress(guestState)) {
          // Ask before doing anything -- don't silently overwrite
          // either the guest progress or the account's existing cloud
          // progress.
          setPending({ guestState, accountState });
          return;
        }

        // Nothing local worth asking about -- just load whatever the
        // account already has (or leave empty local state if it has
        // none yet).
        if (accountState) {
          localStorage.setItem("wt:state:v1", JSON.stringify(accountState));
          window.dispatchEvent(new CustomEvent("wt:state"));
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Push local changes to the cloud for whoever's currently signed in,
  // debounced so rapid actions (reading several articles in a row)
  // collapse into one write instead of one per action.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      const userId = currentUserId.current;
      if (!userId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        pushRemote(userId, load());
      }, PUSH_DEBOUNCE_MS);
    };
    window.addEventListener("wt:state", onChange);
    return () => {
      window.removeEventListener("wt:state", onChange);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function resolveKeepGuest() {
    if (!pending || !currentUserId.current) return;
    const userId = currentUserId.current;
    const merged = pending.accountState
      ? mergeStates(pending.accountState, pending.guestState)
      : pending.guestState;
    localStorage.setItem("wt:state:v1", JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("wt:state"));
    pushRemote(userId, merged);
    setPending(null);
  }

  function resolveDiscardGuest() {
    if (!pending || !currentUserId.current) return;
    const userId = currentUserId.current;
    resetLocal();
    if (pending.accountState) {
      localStorage.setItem("wt:state:v1", JSON.stringify(pending.accountState));
      window.dispatchEvent(new CustomEvent("wt:state"));
    } else {
      // Brand-new account with no cloud progress yet -- start clean and
      // start syncing.
      pushRemote(userId, load());
    }
    setPending(null);
  }

  return { pending, resolveKeepGuest, resolveDiscardGuest };
}
