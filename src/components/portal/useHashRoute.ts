'use client';

/* ==========================================================================
   Hash-based portal routing so refresh, back/forward and deep links work
   without extra Next.js routes.
   Format: #/<tab>?student=<id>&school=<id>&prompt=<id>
   ========================================================================== */

import { useCallback, useSyncExternalStore } from 'react';
import type { StudentFocus } from './nav';

export interface PortalRoute {
  tab: string | null;
  /** Counselor viewing a specific student. */
  studentId: string | null;
  focus: StudentFocus;
}

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

function getHash() {
  return window.location.hash;
}

function getServerHash() {
  return '';
}

export function parseRoute(hash: string): PortalRoute {
  const raw = hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  return {
    tab: path || null,
    studentId: params.get('student'),
    focus: {
      schoolId: params.get('school') ?? undefined,
      promptId: params.get('prompt') ?? undefined,
    },
  };
}

export function buildHash(route: PortalRoute): string {
  const params = new URLSearchParams();
  if (route.studentId) params.set('student', route.studentId);
  if (route.focus.schoolId) params.set('school', route.focus.schoolId);
  if (route.focus.promptId) params.set('prompt', route.focus.promptId);
  const query = params.toString();
  return `#/${route.tab ?? ''}${query ? `?${query}` : ''}`;
}

export function useHashRoute() {
  const hash = useSyncExternalStore(subscribe, getHash, getServerHash);
  const route = parseRoute(hash);

  const navigate = useCallback((next: PortalRoute) => {
    const target = buildHash(next);
    if (target !== window.location.hash) {
      window.location.hash = target;
    }
  }, []);

  return { route, navigate };
}
