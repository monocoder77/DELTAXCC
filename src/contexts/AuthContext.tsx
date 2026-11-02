'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
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

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();
    let active = true;

    async function fetchProfile(userId: string) {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!active) return;
      setProfile((data as Profile) ?? null);
      setLoading(false);
    }

    // onAuthStateChange fires INITIAL_SESSION on subscribe, so it covers the first load too.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        // Defer the query so it doesn't run inside the auth callback (Supabase deadlock guidance).
        setTimeout(() => fetchProfile(currentUser.id), 0);
      } else {
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
    localStorage.removeItem('portal_auth');
    localStorage.removeItem('portal_role');
    if (configured) await getSupabase().auth.signOut();
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
