'use client';

/* ==========================================================================
   Demo portal: the full portal running on fictional sample data in memory.
   Nothing here touches the real database. Switch between the student and
   counselor views from the banner.
   ========================================================================== */

import { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import PortalApp from '@/components/portal/PortalApp';
import { AuthContext } from '@/contexts/AuthContext';
import { BackendProvider } from '@/lib/backend/context';
import { createDemoBackend } from '@/lib/backend/demo';
import { DEMO_COUNSELOR_ID, DEMO_STUDENT_ID, createDemoDb } from '@/lib/backend/demo-data';
import { Diamond, cx } from '@/components/portal/ui/primitives';

export type DemoRole = 'student' | 'counselor';

export default function DemoPortal({ initialRole }: { initialRole: DemoRole }) {
  const [backend] = useState(createDemoBackend);
  const [role, setRole] = useState<DemoRole>(initialRole);
  const people = useMemo(() => createDemoDb().profiles, []);
  const profile = people.find((p) => p.id === (role === 'student' ? DEMO_STUDENT_ID : DEMO_COUNSELOR_ID)) ?? null;

  const switchRole = (next: DemoRole) => {
    if (next === role) return;
    const url = new URL(window.location.href);
    url.searchParams.set('as', next);
    url.hash = '';
    window.history.replaceState(null, '', url.toString());
    setRole(next);
  };

  const auth = useMemo(
    () => ({
      user: profile ? ({ id: profile.id, email: profile.email } as User) : null,
      profile,
      loading: false,
      isDemo: true,
      signOut: async () => {},
    }),
    [profile],
  );

  const banner = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-portal-accent/40 bg-portal-bg/85 px-4 py-2 backdrop-blur-md sm:px-6">
      <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-portal-accent-light">
        <Diamond size={6} /> Demo portal
      </span>
      <span className="hidden text-xs text-portal-muted md:inline">Fictional sample data. Changes reset when you reload.</span>
      <div className="ml-auto flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim">View as</span>
        <div className="flex border border-portal-line-strong" role="group" aria-label="Demo role">
          {(['student', 'counselor'] as DemoRole[]).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={role === r}
              onClick={() => switchRole(r)}
              className={cx(
                'h-7 px-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
                role === r ? 'bg-portal-accent text-white' : 'text-portal-muted hover:text-portal-text',
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <a href="/portal/login" className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted hover:text-portal-text">
          Exit
        </a>
      </div>
    </div>
  );

  return (
    <AuthContext.Provider value={auth}>
      <BackendProvider backend={backend}>
        <PortalApp key={role} banner={banner} onSignedOut={() => window.location.assign('/portal/login')} />
      </BackendProvider>
    </AuthContext.Provider>
  );
}
