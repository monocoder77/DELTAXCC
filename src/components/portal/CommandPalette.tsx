'use client';

/* ==========================================================================
   Command palette (Ctrl/Cmd + K): jump to any tab, school, or student.
   ========================================================================== */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Diamond, Kbd, cx } from './ui/primitives';
import { IconArrowRight, IconSearch } from './ui/icons';

export interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  run: () => void;
}

export default function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  if (!open) return null;
  return <PaletteBody onClose={onClose} commands={commands} />;
}

function PaletteBody({ onClose, commands }: { onClose: () => void; commands: Command[] }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const words = q.split(/\s+/);
    return commands.filter((c) => {
      const text = `${c.label} ${c.group} ${c.hint ?? ''}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [commands, query]);

  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function run(command: Command | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[14vh]">
      <div className="animate-fade fixed inset-0 bg-[#05030a]/80 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to"
        className="animate-rise relative w-full max-w-xl border border-portal-line-strong bg-portal-bg"
      >
        <span className="absolute -top-px left-0 h-[3px] w-20 bg-portal-accent" aria-hidden="true" />
        <div className="flex items-center gap-3 border-b border-portal-line px-5">
          <IconSearch size={16} className="text-portal-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                run(results[activeIndex]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="Jump to a page, school, or student..."
            className="h-14 flex-1 bg-transparent text-[15px] text-portal-text placeholder:text-portal-dim focus:outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[activeIndex] ? `cmd-${results[activeIndex].id}` : undefined}
          />
          <Kbd>Esc</Kbd>
        </div>

        <ul id="palette-results" ref={listRef} role="listbox" className="portal-scroll max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 && <li className="px-5 py-8 text-center text-sm text-portal-muted">No matches.</li>}
          {results.map((c, i) => {
            const header = i === 0 || results[i - 1].group !== c.group ? c.group : null;
            const isActive = i === activeIndex;
            return (
              <li key={c.id}>
                {header && (
                  <p className="px-5 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-portal-dim">{header}</p>
                )}
                <button
                  id={`cmd-${c.id}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  data-active={isActive}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(c)}
                  className={cx(
                    'flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm',
                    isActive ? 'bg-portal-select text-portal-text' : 'text-portal-body',
                  )}
                >
                  <Diamond size={6} filled={isActive} />
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-portal-dim">{c.hint}</span>}
                  {isActive && <IconArrowRight size={14} className="text-portal-accent-light" />}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-4 border-t border-portal-line px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-portal-dim">
          <span className="flex items-center gap-1.5">
            <Kbd>Up</Kbd>
            <Kbd>Down</Kbd> move
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>Enter</Kbd> open
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Kbd>G</Kbd> then a letter jumps tabs
          </span>
        </div>
      </div>
    </div>
  );
}
