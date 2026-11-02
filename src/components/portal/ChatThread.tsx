'use client';

/* ==========================================================================
   Chat thread shared by the student and counselor message panels.
   No bubbles: each message is a ruled line item. Mine sit right with an
   accent rule, theirs sit left with a neutral rule. Fills its parent height.
   ========================================================================== */

import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import type { Message, Profile } from '@/types/database';
import { errorMessage, useNow } from '@/lib/hooks';
import { Avatar, Button, cx } from './ui/primitives';
import { IconArrowDown, IconLink, IconSend } from './ui/icons';

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 96;
const COMPOSER_MAX_PX = 168;
const URL_SPLIT = /(https?:\/\/[^\s<>"']+)/g;

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */
function timeOf(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date, now: Date): string {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - that.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

function clockTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Plain text with http(s) URLs turned into links. Never touches innerHTML. */
function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  text.split(URL_SPLIT).forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 0) {
      out.push(<Fragment key={i}>{part}</Fragment>);
      return;
    }
    // Trailing punctuation usually belongs to the sentence, not the link.
    const m = /^(.*?)([.,;:!?'")\]}]*)$/.exec(part);
    let url = m ? m[1] : part;
    let trail = m ? m[2] : '';
    if (trail.startsWith(')') && url.split('(').length > url.split(')').length) {
      url += ')';
      trail = trail.slice(1);
    }
    if (!isHttpUrl(url)) {
      out.push(<Fragment key={i}>{part}</Fragment>);
      return;
    }
    out.push(
      <a
        key={i}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-portal-accent-light underline decoration-portal-accent/40 underline-offset-2 hover:decoration-portal-accent-light"
      >
        {url}
      </a>,
    );
    if (trail) out.push(<Fragment key={`${i}t`}>{trail}</Fragment>);
  });
  return out;
}

/* --------------------------------------------------------------------------
   Thread model: day separators and sender groups
   -------------------------------------------------------------------------- */
interface Group {
  key: string;
  senderId: string;
  mine: boolean;
  name: string;
  initials: string;
  startedAt: Date;
  messages: Message[];
}

type Row = { kind: 'day'; key: string; label: string } | { kind: 'group'; group: Group };

function buildRows(
  messages: Message[],
  peopleById: Record<string, Profile>,
  meId: string,
  now: Date,
): Row[] {
  const sorted = [...messages].sort((a, b) => timeOf(a.created_at) - timeOf(b.created_at) || a.id.localeCompare(b.id));
  const meRole = peopleById[meId]?.role;
  const otherFallback = meRole === 'consultant' ? 'Student' : 'Your counselor';

  const rows: Row[] = [];
  let lastDay = '';
  let current: Group | null = null;
  let lastTime = 0;

  for (const msg of sorted) {
    const t = timeOf(msg.created_at);
    const d = new Date(t);
    const dk = dayKey(d);
    if (dk !== lastDay) {
      rows.push({ kind: 'day', key: `day-${dk}`, label: dayLabel(d, now) });
      lastDay = dk;
      current = null;
    }
    if (current && current.senderId === msg.sender_id && t - lastTime <= GROUP_WINDOW_MS) {
      current.messages.push(msg);
    } else {
      const mine = msg.sender_id === meId;
      const person = peopleById[msg.sender_id] ?? msg.sender;
      const name = mine ? 'You' : person?.full_name?.trim() || otherFallback;
      current = {
        key: msg.id,
        senderId: msg.sender_id,
        mine,
        name,
        initials: person?.avatar_initials || initialsOf(person?.full_name ?? '') || (mine ? 'ME' : 'DX'),
        startedAt: d,
        messages: [msg],
      };
      rows.push({ kind: 'group', group: current });
    }
    lastTime = t;
  }
  return rows;
}

/* --------------------------------------------------------------------------
   Component
   -------------------------------------------------------------------------- */
export default function ChatThread({
  messages,
  peopleById,
  meId,
  onSend,
  disabled = false,
  disabledReason,
  emptyText = 'No messages yet. Say hello.',
  className,
}: {
  messages: Message[];
  peopleById: Record<string, Profile>;
  meId: string;
  onSend: (text: string) => Promise<unknown>;
  disabled?: boolean;
  disabledReason?: string;
  emptyText?: string;
  className?: string;
}) {
  const now = useNow(60_000);
  const rows = useMemo(() => buildRows(messages, peopleById, meId, now), [messages, peopleById, meId, now]);

  // Latest message, used for scroll decisions and the "new messages" jump.
  const ordered = useMemo(
    () => [...messages].sort((a, b) => timeOf(a.created_at) - timeOf(b.created_at) || a.id.localeCompare(b.id)),
    [messages],
  );
  const last = ordered[ordered.length - 1] ?? null;
  const lastId = last?.id ?? null;
  const lastMine = last ? last.sender_id === meId : false;

  const logRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const prevLastRef = useRef<string | null | undefined>(undefined);
  const [atBottom, setAtBottom] = useState(true);
  const [seenId, setSeenId] = useState<string | null>(lastId);

  const unseen = useMemo(() => {
    if (!seenId) return ordered.filter((m) => m.sender_id !== meId).length;
    const idx = ordered.findIndex((m) => m.id === seenId);
    if (idx === -1) return 0;
    return ordered.slice(idx + 1).filter((m) => m.sender_id !== meId).length;
  }, [ordered, seenId, meId]);
  const showJump = !atBottom && unseen > 0;

  function handleScroll() {
    const el = logRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    nearBottomRef.current = near;
    setAtBottom(near);
    if (near) setSeenId(lastId);
  }

  function scrollToEnd(smooth: boolean) {
    const el = logRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }

  // Stick to the bottom on first paint, on my own sends, and on arrivals
  // while the reader is already at the bottom. Otherwise leave them be.
  useLayoutEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const prev = prevLastRef.current;
    prevLastRef.current = lastId;
    if (prev === undefined || (lastId !== prev && (lastMine || nearBottomRef.current))) {
      el.scrollTop = el.scrollHeight;
      nearBottomRef.current = true;
    }
  }, [lastId, lastMine]);

  // Keep pinned when the log resizes (composer grows, window resizes).
  useEffect(() => {
    const el = logRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (nearBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={cx('flex h-full min-h-0 flex-col', className)}>
      <div className="relative min-h-0 flex-1">
        <div
          ref={logRef}
          onScroll={handleScroll}
          role="log"
          aria-live="polite"
          aria-label="Messages"
          tabIndex={0}
          className="portal-scroll h-full overflow-y-auto overscroll-contain px-4 py-6 sm:px-6"
        >
          {rows.length === 0 ? (
            <EmptyThread text={emptyText} />
          ) : (
            <ol className="flex flex-col gap-5">
              {rows.map((row) =>
                row.kind === 'day' ? (
                  <li key={row.key} className="flex items-center gap-3 py-1">
                    <span className="h-px flex-1 bg-portal-line" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-portal-dim">{row.label}</span>
                    <span className="h-px flex-1 bg-portal-line" />
                  </li>
                ) : (
                  <MessageGroup key={row.group.key} group={row.group} />
                ),
              )}
            </ol>
          )}
        </div>

        {showJump && (
          <button
            type="button"
            onClick={() => scrollToEnd(true)}
            className="animate-rise absolute bottom-4 left-1/2 inline-flex h-8 -translate-x-1/2 items-center gap-2 border border-portal-accent bg-portal-bg px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-accent-light hover:bg-portal-select"
          >
            <span className="inline-block h-1.5 w-1.5 bg-portal-accent" aria-hidden="true" />
            {unseen === 1 ? 'New message' : `${unseen} new messages`}
            <IconArrowDown size={12} />
          </button>
        )}
      </div>

      <Composer onSend={onSend} disabled={disabled} disabledReason={disabledReason} onSent={() => scrollToEnd(false)} />
    </div>
  );
}

/* --------------------------------------------------------------------------
   Pieces
   -------------------------------------------------------------------------- */
function EmptyThread({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
      <div className="relative mb-5 h-8 w-8" aria-hidden="true">
        <span className="absolute inset-0 rotate-45 border border-portal-line-strong" />
        <span className="absolute inset-[34%] rotate-45 bg-portal-accent/70" />
      </div>
      <p className="max-w-xs text-sm text-portal-muted">{text}</p>
    </div>
  );
}

function MessageGroup({ group }: { group: Group }) {
  const { mine } = group;
  return (
    <li className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cx(
          'min-w-0 max-w-[88%] sm:max-w-[72%]',
          mine ? 'border-r-2 border-portal-accent pr-4' : 'border-l border-portal-line-strong pl-4',
        )}
      >
        <div className={cx('mb-1.5 flex items-center gap-2.5', mine && 'flex-row-reverse')}>
          <Avatar initials={group.initials} size={20} tone={mine ? 'accent' : 'neutral'} />
          <span className="truncate text-[13px] font-medium text-portal-text">{group.name}</span>
          <time
            dateTime={group.startedAt.toISOString()}
            title={group.startedAt.toLocaleString('en-US')}
            className="flex-none font-mono text-[10px] text-portal-dim"
          >
            {clockTime(group.startedAt)}
          </time>
        </div>
        <div className={cx('flex flex-col gap-1.5', mine && 'items-end')}>
          {group.messages.map((m) => (
            <MessageLine key={m.id} message={m} mine={mine} />
          ))}
        </div>
      </div>
    </li>
  );
}

function MessageLine({ message, mine }: { message: Message; mine: boolean }) {
  const created = new Date(timeOf(message.created_at));
  return (
    <div className="animate-rise max-w-full" title={clockTime(created)}>
      {message.content && (
        <p
          className={cx(
            'whitespace-pre-wrap break-words text-[15px] leading-relaxed',
            mine ? 'text-portal-text' : 'text-portal-body',
          )}
        >
          {linkify(message.content)}
        </p>
      )}
      {isHttpUrl(message.file_url) && (
        <a
          href={message.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-portal-accent-light hover:text-portal-text"
        >
          <IconLink size={12} /> Attachment
        </a>
      )}
    </div>
  );
}

function Composer({
  onSend,
  onSent,
  disabled,
  disabledReason,
}: {
  onSend: (text: string) => Promise<unknown>;
  onSent: () => void;
  disabled: boolean;
  disabledReason?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && !sending && draft.trim().length > 0;

  // Auto-grow up to a cap, then scroll inside the textarea.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_PX)}px`;
  }, [draft]);

  async function submit() {
    const text = draft.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    setError(null);
    try {
      await onSend(text);
      setDraft('');
      onSent();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
      areaRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void submit();
  }

  return (
    <form onSubmit={onSubmit} className="group/composer relative flex-none border-t border-portal-line-strong px-4 pb-4 pt-3 sm:px-6">
      <span
        aria-hidden="true"
        className="absolute -top-px left-0 h-px w-0 bg-portal-accent transition-[width] duration-500 ease-portal group-focus-within/composer:w-full"
      />
      <label htmlFor={id} className="sr-only">
        Message
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={id}
          ref={areaRef}
          rows={1}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={onKeyDown}
          disabled={disabled}
          readOnly={sending}
          placeholder={disabled ? disabledReason ?? 'Messaging is unavailable.' : 'Write a message'}
          className="portal-input min-h-[44px] flex-1 resize-none py-2.5 text-[15px] leading-relaxed"
          style={{ maxHeight: COMPOSER_MAX_PX }}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint`}
        />
        <Button type="submit" variant="primary" className="h-11 flex-none px-4" disabled={!canSend} aria-label="Send message">
          <span className="hidden sm:inline">{sending ? 'Sending' : 'Send'}</span>
          <IconSend size={15} />
        </Button>
      </div>
      <div id={`${id}-hint`} className="mt-2 min-h-[16px] font-mono text-[10px] tracking-[0.04em]">
        {error ? (
          <p role="alert" className="text-portal-red">
            Not sent. {error}
          </p>
        ) : disabled && disabledReason ? (
          <p className="text-portal-muted">{disabledReason}</p>
        ) : (
          <p className="hidden text-portal-dim sm:block">Enter to send. Shift + Enter for a new line.</p>
        )}
      </div>
    </form>
  );
}
