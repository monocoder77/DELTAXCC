'use client';

import { createContext, useContext, useMemo, useRef } from 'react';
import type { PortalBackend, TableName } from './types';

type ChangeListener = (tables: TableName[], source: symbol | null) => void;

interface BackendContextValue {
  api: PortalBackend;
  /** Announce that a mutation touched these tables so other hooks can refresh. */
  emit: (tables: TableName[], source?: symbol | null) => void;
  /** Listen for table changes. Returns an unsubscribe function. */
  subscribe: (listener: ChangeListener) => () => void;
}

const BackendContext = createContext<BackendContextValue | null>(null);

export function BackendProvider({ backend, children }: { backend: PortalBackend; children: React.ReactNode }) {
  const listeners = useRef(new Set<ChangeListener>());

  const value = useMemo<BackendContextValue>(
    () => ({
      api: backend,
      emit: (tables, source = null) => {
        listeners.current.forEach((listener) => listener(tables, source));
      },
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
    }),
    [backend],
  );

  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

export function useBackend(): BackendContextValue {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error('useBackend must be used inside <BackendProvider>');
  return ctx;
}
