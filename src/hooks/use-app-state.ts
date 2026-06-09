import { useEffect, useState, useCallback } from "react";
import { load, save, award, type AppState, type Action } from "@/lib/rewards";

export function useAppState() {
  const [state, setState] = useState<AppState>(() => load());

  useEffect(() => {
    const sync = () => setState(load());
    window.addEventListener("wt:state", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("wt:state", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const doAward = useCallback((a: Action) => {
    setState((s) => award(a, s));
  }, []);

  const update = useCallback((fn: (s: AppState) => AppState) => {
    setState((s) => {
      const next = fn(s);
      save(next);
      return next;
    });
  }, []);

  return { state, award: doAward, update };
}
