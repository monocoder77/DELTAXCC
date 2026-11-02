'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { flushPendingSaves } from '@/lib/pendingSaves';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';

export interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** True inside /portal/demo, where everything runs on sample data. */
  isDemo: boolean;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  isDemo: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(configured);

  // Id of the user whose profile is loaded, so routine auth events (tab focus,
  // hourly token refresh) don't refetch it or replace it after a network blip.
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();
    let active = true;

    async function fetchProfile(userId: string) {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!active) return;
      if (error) {
        // Keep whatever profile we already have; a temporary failure is not a missing account.
        setLoading(false);
        return;
      }
      loadedFor.current = data ? userId : null;
      setProfile((data as Profile) ?? null);
      setLoading(false);
    }

    // onAuthStateChange fires INITIAL_SESSION on subscribe, so it covers the first load too.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        if (loadedFor.current === currentUser.id) return;
        // Defer the query so it doesn't run inside the auth callback (Supabase deadlock guidance).
        setTimeout(() => fetchProfile(currentUser.id), 0);
      } else {
        loadedFor.current = null;
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured]);

  async function signOut() {
    // Write any pending essay edits while the session still exists.
    const saved = await flushPendingSaves();
    if (
      !saved &&
      !window.confirm('Some of your latest edits have not saved yet. They are kept on this device and will come back next time you open the essay. Sign out anyway?')
    ) {
      throw new Error('Sign out cancelled.');
    }
    localStorage.removeItem('portal_auth');
    localStorage.removeItem('portal_role');
    if (configured) await getSupabase().auth.signOut();
    loadedFor.current = null;
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, isDemo: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
