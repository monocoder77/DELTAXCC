'use client';

/* ==========================================================================
   Essay feedback thread, shared by the essay editor and the counselor
   review queue. Ruled list, no bubbles: counselor notes get an accent rule.
   ========================================================================== */

import { useState } from 'react';
import type { EssayComment } from '@/types/database';
import { errorMessage } from '@/lib/hooks';
import { Avatar, Button, Textarea, cx, timeAgo } from './ui/primitives';
import { IconSend } from './ui/icons';

export default function CommentThread({
  comments,
  viewerId,
  onAdd,
  placeholder = 'Leave a note...',
  disabled = false,
  disabledReason,
}: {
  comments: EssayComment[];
  viewerId: string;
  onAdd: (text: string) => Promise<unknown>;
  placeholder?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at));

  async function submit() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      await onAdd(text);
      setDraft('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {sorted.length === 0 ? (
        <p className="border-l border-portal-line py-1 pl-4 text-sm text-portal-dim">No notes yet.</p>
      ) : (
        <ol className="space-y-5">
          {sorted.map((c) => {
            const mine = c.author_id === viewerId;
            const isCounselor = c.author?.role === 'consultant';
            const name = mine ? 'You' : c.author?.full_name ?? (isCounselor ? 'Your counselor' : 'Counselor');
            return (
              <li
                key={c.id}
                className={cx('animate-rise border-l-2 pl-4', isCounselor ? 'border-portal-accent' : 'border-portal-line-strong')}
              >
                <div className="mb-1.5 flex items-center gap-2.5">
                  <Avatar initials={c.author?.avatar_initials ?? (mine ? 'ME' : 'DX')} size={22} tone={isCounselor ? 'accent' : 'neutral'} />
                  <span className="text-sm font-medium text-portal-text">{name}</span>
                  {isCounselor && !mine && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-portal-accent-light">Counselor</span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-portal-dim" title={new Date(c.created_at).toLocaleString()}>
                    {timeAgo(c.created_at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-portal-body">{c.content}</p>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-6">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={disabled ? disabledReason ?? placeholder : placeholder}
          disabled={disabled || sending}
          rows={2}
          className="min-h-[72px] text-sm"
          aria-label="Add a note"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] text-portal-dim">{error ? <span className="text-portal-red">{error}</span> : 'Ctrl + Enter to send'}</span>
          <Button size="sm" variant="primary" onClick={() => void submit()} disabled={disabled || sending || !draft.trim()}>
            {sending ? 'Sending...' : 'Send'} <IconSend size={13} />
          </Button>
        </div>
      </div>
    </div>
  );
}
