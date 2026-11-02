'use client';

/* ==========================================================================
   05 Messages (student portal)
   Student: their thread with their counselor.
   Counselor viewing a student: the same thread, created on first send.
   ========================================================================== */

import { useCallback, useMemo, useState } from 'react';
import type { Conversation, Message, Profile } from '@/types/database';
import { useMe, useMessaging, useNow, useProfile } from '@/lib/hooks';
import type { StudentPanelProps } from './nav';
import ChatThread from './ChatThread';
import { Avatar, Button, EmptyState, LoadingBlock, Panel, PanelHeader, cx, timeAgo } from './ui/primitives';

/** Full-height frame for the thread. The shell's content column scrolls, so keep a floor. */
const THREAD_FRAME =
  'flex h-[calc(100dvh-9rem)] min-h-[440px] flex-col border-y border-portal-line-strong lg:h-[calc(100dvh-8rem)]';

interface RankedThread {
  conversation: Conversation;
  messages: Message[];
  last: Message | null;
}

function timeOf(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** Conversations with their messages, most recent activity first. */
function rankThreads(conversations: Conversation[], messages: Message[]): RankedThread[] {
  const byConv = new Map<string, Message[]>();
  messages.forEach((m) => {
    const list = byConv.get(m.conversation_id);
    if (list) list.push(m);
    else byConv.set(m.conversation_id, [m]);
  });
  return conversations
    .map((conversation) => {
      const list = byConv.get(conversation.id) ?? [];
      const last = list.reduce<Message | null>((acc, m) => (!acc || timeOf(m.created_at) >= timeOf(acc.created_at) ? m : acc), null);
      return { conversation, messages: list, last };
    })
    .sort((a, b) => timeOf(b.last?.created_at) - timeOf(a.last?.created_at));
}

export default function MessagesPanel({ studentId, viewer }: StudentPanelProps) {
  return viewer === 'counselor' ? <CounselorView studentId={studentId} /> : <StudentView studentId={studentId} />;
}

/* --------------------------------------------------------------------------
   Student
   -------------------------------------------------------------------------- */
function StudentView({ studentId }: { studentId: string }) {
  const me = useMe();
  const { conversations, messages, peopleById, loading, error, send } = useMessaging(null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const threads = useMemo(
    () => rankThreads(conversations.filter((c) => c.student_id === studentId), messages),
    [conversations, messages, studentId],
  );
  // Once a thread is on screen, stay on it: a message arriving in another thread
  // must not switch conversations (and wipe a reply being typed).
  if (pickedId === null && threads[0]) setPickedId(threads[0].conversation.id);
  const active = threads.find((t) => t.conversation.id === pickedId) ?? threads[0] ?? null;
  const counselor = active ? peopleById[active.conversation.consultant_id] : undefined;
  const counselorName = counselor?.full_name?.trim() || 'Your counselor';

  const activeId = active?.conversation.id ?? null;
  const onSend = useCallback(
    async (text: string) => {
      if (!activeId) throw new Error('There is no conversation to send to yet.');
      return send(activeId, text);
    },
    [activeId, send],
  );

  const header = (
    <PanelHeader
      index="05"
      eyebrow="Messages"
      title={active ? counselorName : 'Messages'}
      description={
        active
          ? 'A direct line to your counselor. Questions, drafts, deadlines, anything on your mind.'
          : 'Your conversation with your counselor lives here.'
      }
      actions={
        threads.length > 1 ? (
          <ThreadSwitcher
            threads={threads}
            activeId={activeId}
            labelFor={(t) => peopleById[t.conversation.consultant_id]?.full_name?.trim() || 'Counselor'}
            onPick={setPickedId}
          />
        ) : undefined
      }
    />
  );

  if (!me || loading) {
    return (
      <Panel>
        {header}
        <LoadingBlock label="Loading messages" />
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel>
        {header}
        <LoadError message={error} />
      </Panel>
    );
  }

  if (!active) {
    return (
      <Panel>
        {header}
        <EmptyState
          title="No messages yet"
          body="Your counselor will start this thread. Once they do, you can reply here, and every message stays in one place."
        />
      </Panel>
    );
  }

  return (
    <Panel>
      {header}
      <section className={THREAD_FRAME} aria-label={`Conversation with ${counselorName}`}>
        <ThreadHeader person={counselor} name={counselorName} role="Counselor" thread={active} />
        <div className="min-h-0 flex-1">
          <ChatThread
            key={active.conversation.id}
            messages={active.messages}
            peopleById={peopleById}
            meId={me.id}
            onSend={onSend}
            emptyText={`No messages yet. Say hello to ${counselor?.full_name?.split(' ')[0] || 'your counselor'}.`}
          />
        </div>
      </section>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
   Counselor viewing a student
   -------------------------------------------------------------------------- */
function CounselorView({ studentId }: { studentId: string }) {
  const me = useMe();
  const ids = useMemo(() => [studentId], [studentId]);
  const { conversations, messages, peopleById, loading, error, send, startConversation } = useMessaging(ids);
  const { profile: studentProfile } = useProfile(studentId);

  const threads = useMemo(
    () => rankThreads(conversations.filter((c) => c.student_id === studentId), messages),
    [conversations, messages, studentId],
  );
  // Prefer the thread this counselor owns; otherwise the most recent one.
  const active = threads.find((t) => t.conversation.consultant_id === me?.id) ?? threads[0] ?? null;
  const student = studentProfile ?? peopleById[studentId];
  const studentName = student?.full_name?.trim() || 'Student';
  const otherCounselor =
    active && me && active.conversation.consultant_id !== me.id ? peopleById[active.conversation.consultant_id] : undefined;

  const activeConversation = active?.conversation ?? null;
  const onSend = useCallback(
    async (text: string) => {
      const conversation = activeConversation ?? (await startConversation(studentId));
      return send(conversation.id, text);
    },
    [activeConversation, startConversation, send, studentId],
  );

  const header = (
    <PanelHeader
      index="05"
      eyebrow="Messages"
      title={studentName}
      description={`Your thread with ${student?.full_name?.split(' ')[0] || 'this student'}. They see these messages in their portal.`}
    />
  );

  if (!me || loading) {
    return (
      <Panel>
        {header}
        <LoadingBlock label="Loading messages" />
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel>
        {header}
        <LoadError message={error} />
      </Panel>
    );
  }

  return (
    <Panel>
      {header}
      <section className={THREAD_FRAME} aria-label={`Conversation with ${studentName}`}>
        <ThreadHeader
          person={student}
          name={studentName}
          role={otherCounselor ? `Thread with ${otherCounselor.full_name}` : student?.email || 'Student'}
          thread={active}
        />
        <div className="min-h-0 flex-1">
          <ChatThread
            key={studentId}
            messages={active?.messages ?? []}
            peopleById={peopleById}
            meId={me.id}
            onSend={onSend}
            emptyText={`No messages with ${student?.full_name?.split(' ')[0] || 'this student'} yet. Your first message starts the thread.`}
          />
        </div>
      </section>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
   Pieces
   -------------------------------------------------------------------------- */
function ThreadHeader({
  person,
  name,
  role,
  thread,
}: {
  person: Profile | undefined;
  name: string;
  role: string;
  thread: RankedThread | null;
}) {
  const now = useNow(60_000);
  const count = thread?.messages.length ?? 0;
  const lastAt = thread?.last?.created_at ?? null;
  return (
    <div className="flex flex-none items-center gap-3 border-b border-portal-line px-4 py-3 sm:px-6">
      <Avatar initials={person?.avatar_initials || 'DX'} size={36} tone="accent" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-base font-bold leading-tight text-portal-text">{name}</p>
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">{role}</p>
      </div>
      <dl className="hidden flex-none items-center gap-5 font-mono text-[10px] uppercase tracking-[0.16em] sm:flex">
        <div className="text-right">
          <dt className="text-portal-dim">Messages</dt>
          <dd className="tabular-nums text-portal-text">{String(count).padStart(2, '0')}</dd>
        </div>
        <span className="h-6 w-px bg-portal-line" aria-hidden="true" />
        <div className="text-right">
          <dt className="text-portal-dim">Last</dt>
          <dd className="text-portal-text">{lastAt ? timeAgo(lastAt, now) : 'None yet'}</dd>
        </div>
      </dl>
    </div>
  );
}

function ThreadSwitcher({
  threads,
  activeId,
  labelFor,
  onPick,
}: {
  threads: RankedThread[];
  activeId: string | null;
  labelFor: (t: RankedThread) => string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Choose a conversation">
      {threads.map((t) => {
        const on = t.conversation.id === activeId;
        return (
          <button
            key={t.conversation.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(t.conversation.id)}
            className={cx(
              'inline-flex h-8 items-center gap-2 border px-3 text-xs transition-colors',
              on
                ? 'border-portal-accent text-portal-text'
                : 'border-portal-line-strong text-portal-muted hover:border-portal-text hover:text-portal-text',
            )}
          >
            <span className={cx('inline-block h-1.5 w-1.5', on ? 'bg-portal-accent' : 'bg-portal-line-strong')} aria-hidden="true" />
            {labelFor(t)}
          </button>
        );
      })}
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex flex-col gap-4 border-l-2 border-portal-red py-2 pl-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-red">Could not load messages</p>
        <p className="mt-1 text-sm text-portal-body">{message}</p>
      </div>
      <Button size="sm" onClick={() => window.location.reload()}>
        Try again
      </Button>
    </div>
  );
}
