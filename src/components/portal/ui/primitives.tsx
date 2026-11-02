'use client';

/* ==========================================================================
   Portal UI primitives
   Geometric and card-free: hairline rules, square corners, diamond accents,
   flat color. Every panel builds from these so the portal stays consistent.
   ========================================================================== */

import { forwardRef, useEffect, useRef } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import type { EssayStatus, SchoolCategory } from '@/types/database';

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

/* --------------------------------------------------------------------------
   Ambient background (fixed, behind everything)
   -------------------------------------------------------------------------- */
export function Ambient({ calm = false }: { calm?: boolean }) {
  return (
    <div className="portal-ambient" data-calm={calm} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

/* --------------------------------------------------------------------------
   Layout
   -------------------------------------------------------------------------- */

/** Standard page wrapper for a panel. */
export function Panel({ children, className, wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className={cx('mx-auto w-full px-5 pb-24 pt-8 sm:px-8 lg:px-12 lg:pt-12', wide ? 'max-w-[1400px]' : 'max-w-[1120px]', className)}>
      {children}
    </div>
  );
}

/**
 * Panel header: mono index + eyebrow, serif title, optional description and actions.
 * index renders like "02" to number the sections of the portal.
 */
export function PanelHeader({
  index,
  eyebrow,
  title,
  description,
  actions,
}: {
  index?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="animate-rise mb-10 flex flex-col gap-6 border-b border-portal-line-strong pb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {(index || eyebrow) && (
          <p className="mb-3 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-portal-accent-light">
            {index && <span>{index}</span>}
            {index && eyebrow && <span className="h-px w-6 bg-portal-accent/60" />}
            {eyebrow && <span className="text-portal-muted">{eyebrow}</span>}
          </p>
        )}
        <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight text-portal-text sm:text-4xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-portal-body">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Section label: diamond + uppercase mono text + rule that runs to the edge. */
export function SectionLabel({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-4 flex items-center gap-3', className)}>
      <Diamond size={7} />
      <h2 className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.18em] text-portal-muted">{children}</h2>
      <span className="h-px flex-1 bg-portal-line" />
      {action}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Geometry
   -------------------------------------------------------------------------- */
export function Diamond({
  size = 8,
  filled = true,
  className,
  color,
}: {
  size?: number;
  filled?: boolean;
  className?: string;
  color?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx('inline-block flex-none rotate-45', className)}
      style={{
        width: size,
        height: size,
        background: filled ? color ?? 'var(--color-portal-accent)' : 'transparent',
        border: filled ? undefined : `1px solid ${color ?? 'var(--color-portal-accent-light)'}`,
      }}
    />
  );
}

/** Rotating square loader. */
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-portal-muted">
      <span
        className="inline-block h-3 w-3 border border-portal-accent-light"
        style={{ animation: 'portal-spin-square 1.2s cubic-bezier(0.65, 0, 0.35, 1) infinite' }}
      />
      {label}
    </div>
  );
}

export function LoadingBlock({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

/* --------------------------------------------------------------------------
   Buttons
   -------------------------------------------------------------------------- */
type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const buttonBase =
  'inline-flex items-center justify-center gap-2 border font-medium tracking-[0.01em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40';
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'border-portal-accent bg-portal-accent text-white hover:border-portal-accent-deep hover:bg-portal-accent-deep',
  outline: 'border-portal-line-strong bg-transparent text-portal-text hover:border-portal-text',
  ghost: 'border-transparent bg-transparent text-portal-muted hover:text-portal-text hover:bg-portal-hover',
  danger: 'border-portal-red/50 bg-transparent text-portal-red hover:border-portal-red hover:bg-portal-red/10',
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
};

export function buttonClass(variant: ButtonVariant = 'outline', size: ButtonSize = 'md', className?: string) {
  return cx(buttonBase, buttonVariants[variant], buttonSizes[size], className);
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ variant = 'outline', size = 'md', className, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
});

/** Square icon-only button. Always pass an aria-label. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string; tone?: 'default' | 'danger' }
>(function IconButton({ className, tone = 'default', type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex h-8 w-8 flex-none items-center justify-center border border-transparent text-portal-muted transition-colors',
        tone === 'danger' ? 'hover:border-portal-red/40 hover:text-portal-red' : 'hover:border-portal-line-strong hover:text-portal-text',
        'disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
});

/* --------------------------------------------------------------------------
   Form fields
   -------------------------------------------------------------------------- */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
  counter,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  counter?: ReactNode;
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">
          {label}
        </label>
        {counter && <span className="font-mono text-[10px] text-portal-dim">{counter}</span>}
      </div>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-portal-red">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-portal-dim">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cx('portal-input', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cx('portal-input min-h-[96px] resize-y leading-relaxed', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return <select ref={ref} className={cx('portal-input', className)} {...props} />;
});

export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  className?: string;
}) {
  return (
    <input
      type="checkbox"
      className={cx('portal-check', className)}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      aria-label={label}
    />
  );
}

/* --------------------------------------------------------------------------
   Tags, statuses, avatars
   -------------------------------------------------------------------------- */
export type Tone = 'neutral' | 'accent' | 'gold' | 'green' | 'amber' | 'red' | 'blue';

export const toneColor: Record<Tone, string> = {
  neutral: 'var(--color-portal-muted)',
  accent: 'var(--color-portal-accent-light)',
  gold: 'var(--color-portal-gold)',
  green: 'var(--color-portal-green)',
  amber: 'var(--color-portal-amber)',
  red: 'var(--color-portal-red)',
  blue: 'var(--color-portal-blue)',
};

/** Outlined square tag with mono uppercase text. */
export function Tag({ children, tone = 'neutral', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  const color = toneColor[tone];
  return (
    <span
      className={cx('inline-flex h-5 items-center whitespace-nowrap border px-1.5 font-mono text-[10px] uppercase leading-none tracking-[0.12em]', className)}
      style={{ color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
    >
      {children}
    </span>
  );
}

export const categoryTone: Record<SchoolCategory, Tone> = {
  reach: 'red',
  target: 'gold',
  safety: 'green',
};

export function CategoryTag({ category }: { category: SchoolCategory }) {
  return <Tag tone={categoryTone[category]}>{category}</Tag>;
}

/** Essay status metadata. step = how far along (0 to 5), used by glyphs and bars. */
export const ESSAY_STATUS: Record<EssayStatus, { label: string; tone: Tone; step: number }> = {
  not_started: { label: 'Not started', tone: 'neutral', step: 0 },
  draft: { label: 'Drafting', tone: 'blue', step: 1 },
  in_review: { label: 'In review', tone: 'amber', step: 2 },
  revision: { label: 'Revising', tone: 'accent', step: 3 },
  final: { label: 'Final', tone: 'green', step: 4 },
  submitted: { label: 'Submitted', tone: 'gold', step: 5 },
};

export const ESSAY_STATUS_ORDER: EssayStatus[] = ['not_started', 'draft', 'in_review', 'revision', 'final', 'submitted'];

/**
 * Essay status glyph: a diamond that fills as the essay progresses.
 * Hollow = not started, quarter steps up to solid = final, solid gold = submitted.
 */
export function StatusGlyph({ status, size = 10 }: { status: EssayStatus; size?: number }) {
  const meta = ESSAY_STATUS[status];
  const color = toneColor[meta.tone];
  const fill = Math.min(meta.step / 4, 1);
  return (
    <span
      aria-hidden="true"
      className="relative inline-block flex-none rotate-45 overflow-hidden"
      style={{ width: size, height: size, border: `1px solid ${color}` }}
    >
      <span className="absolute inset-x-0 bottom-0" style={{ height: `${fill * 100}%`, background: color }} />
    </span>
  );
}

export function StatusTag({ status }: { status: EssayStatus }) {
  const meta = ESSAY_STATUS[status];
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: toneColor[meta.tone] }}>
      <StatusGlyph status={status} size={8} />
      {meta.label}
    </span>
  );
}

/** Square initials avatar. */
export function Avatar({ initials, size = 36, tone = 'accent' }: { initials: string; size?: number; tone?: Tone }) {
  const color = toneColor[tone];
  return (
    <span
      aria-hidden="true"
      className="inline-flex flex-none items-center justify-center font-mono font-bold uppercase"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.32),
        color,
        border: `1px solid color-mix(in srgb, ${color} 55%, transparent)`,
      }}
    >
      {initials || '?'}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center border border-portal-line-strong px-1 font-mono text-[10px] text-portal-muted">
      {children}
    </kbd>
  );
}

/* --------------------------------------------------------------------------
   Data display
   -------------------------------------------------------------------------- */

/** Big mono number with a label underneath. */
export function Stat({ value, label, tone = 'neutral', sub }: { value: ReactNode; label: ReactNode; tone?: Tone; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div
        className="font-mono text-3xl font-bold leading-none tabular-nums sm:text-4xl"
        style={{ color: tone === 'neutral' ? 'var(--color-portal-text)' : toneColor[tone] }}
      >
        {value}
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">{label}</div>
      {sub && <div className="mt-1 text-xs text-portal-dim">{sub}</div>}
    </div>
  );
}

/** Row of stats separated by vertical rules, framed by horizontal rules. */
export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'grid grid-cols-2 border-y border-portal-line-strong md:auto-cols-fr md:grid-flow-col md:grid-cols-none',
        '[&>*]:border-portal-line [&>*]:px-0 [&>*]:py-6 md:[&>*]:px-6 md:[&>*:first-child]:pl-0 md:[&>*+*]:border-l',
        '[&>*:nth-child(even)]:border-l [&>*:nth-child(even)]:pl-5 md:[&>*:nth-child(even)]:pl-6 [&>*:nth-child(n+3)]:border-t md:[&>*:nth-child(n+3)]:border-t-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Segmented progress bar made of square cells.
 * value/max fills that many of `segments` cells.
 */
export function SegmentBar({
  value,
  max,
  segments = 20,
  tone = 'accent',
  label,
  className,
}: {
  value: number;
  max: number;
  segments?: number;
  tone?: Tone;
  label?: string;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const filled = Math.round(ratio * segments);
  const color = toneColor[tone];
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cx('flex gap-[3px]', className)}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className="h-2 flex-1 transition-colors duration-500"
          style={{
            background: i < filled ? color : 'rgba(255,255,255,0.07)',
            transitionDelay: `${i * 18}ms`,
          }}
        />
      ))}
    </div>
  );
}

/** Thin line meter for word counts. Turns amber near the limit and red over it. */
export function LineMeter({ value, max, className }: { value: number; max: number; className?: string }) {
  const ratio = max > 0 ? value / max : 0;
  const color = ratio > 1 ? toneColor.red : ratio > 0.9 ? toneColor.amber : toneColor.accent;
  return (
    <div className={cx('relative h-px w-full bg-portal-line-strong', className)} aria-hidden="true">
      <div className="absolute inset-y-[-1px] left-0 transition-all duration-500" style={{ width: `${Math.min(ratio, 1) * 100}%`, background: color }} />
    </div>
  );
}

/* --------------------------------------------------------------------------
   Empty state
   -------------------------------------------------------------------------- */
export function EmptyState({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center border-y border-dashed border-portal-line-strong px-6 py-14 text-center">
      <div className="relative mb-6 h-10 w-10">
        <span className="absolute inset-0 rotate-45 border border-portal-accent/50" />
        <span className="absolute inset-[30%] rotate-45 bg-portal-accent/70" />
      </div>
      <p className="font-serif text-lg text-portal-text">{title}</p>
      {body && <p className="mt-2 max-w-sm text-sm text-portal-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Dialog (sharp, ruled, no card chrome beyond a hairline frame)
   -------------------------------------------------------------------------- */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const first = panelRef.current?.querySelector<HTMLElement>('input, textarea, select, button');
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto px-4 py-[10vh]">
      <div className="animate-fade fixed inset-0 bg-[#05030a]/80 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="animate-rise relative w-full border border-portal-line-strong bg-portal-bg"
        style={{ maxWidth: width }}
      >
        <span className="absolute -top-px left-0 h-[3px] w-16 bg-portal-accent" aria-hidden="true" />
        <div className="flex items-center justify-between gap-4 border-b border-portal-line px-6 py-4">
          <h2 className="font-serif text-lg font-bold text-portal-text">{title}</h2>
          <IconButton aria-label="Close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </IconButton>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-portal-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Formatting helpers
   -------------------------------------------------------------------------- */

/** Parse a YYYY-MM-DD date as a local date (avoids the UTC off-by-one). */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole days from today to the date (negative = past). */
export function daysUntil(value: string | null | undefined, now = new Date()): number | null {
  const d = parseDate(value);
  if (!d) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatDate(value: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  const d = parseDate(value);
  return d ? d.toLocaleDateString('en-US', opts) : 'No date';
}

/** "in 3 days", "today", "2 days ago" */
export function relativeDays(value: string | null | undefined): string {
  const n = daysUntil(value);
  if (n === null) return 'No date';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `In ${n} days` : `${Math.abs(n)} days ago`;
}

/** "2m", "3h", "Mar 4" style timestamp for messages and activity. */
export function timeAgo(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
