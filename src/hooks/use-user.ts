import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange fires an initial event (with whatever session is
    // already persisted in local storage) immediately on subscribe -- no
    // network round-trip required. We previously ALSO called the
    // network-validating supabase.auth.getUser() for the first read; if
    // that call was ever slow or transiently errored, it silently left
    // `user` as null (guest/"Anonymous Reader") with nothing to correct
    // it until some unrelated future auth event happened to fire. Relying
    // on the subscription alone removes that failure mode entirely.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("username, display_name, avatar_url, bio")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [user]);

  return { user, profile, loading, signOut: () => supabase.auth.signOut() };
}
