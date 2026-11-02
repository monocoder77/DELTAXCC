'use client';

/* ==========================================================================
   05 Messages (counselor)
   Two columns split by a vertical rule: every student on the left, sorted
   by latest message, and the selected thread on the right. On small
   screens it shows the list or the thread, with a back button.
   ========================================================================== */

import { useCallback, useMemo, useState } from 'react';
import type { Conversation, Message, Profile } from '@/types/database';
import { useMe, useMessaging, useNow, useStudents } from '@/lib/hooks';
import type { CounselorPanelProps } from '../nav';
import ChatThread from '../ChatThread';
import { Avatar, Button, EmptyState, IconButton, Input, LoadingBlock, Panel, PanelHeader, cx, pad2, timeAgo } from '../ui/primitives';
import { IconArrowLeft, IconArrowRight, IconSearch } from '../ui/icons';

const FRAME =
  'grid h-[calc(100dvh-9rem)] min-h-[480px] grid-cols-1 border-y border-portal-line-strong lg:h-[calc(100dvh-8rem)] lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]';

interface StudentRow {
  student: Profile;
  conversation: Conversation | null;
  messages: Message[];
  last: Message | null;
  awaiting: boolean;
}

function timeOf(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function buildRows(students: Profile[], conversations: Conversation[], messages: Message[], meId: string | undefined): StudentRow[] {
  const byConv = new Map<string, Message[]>();
  messages.forEach((m) => {
    const list = byConv.get(m.conversation_id);
    if (list) list.push(m);
    else byConv.set(m.conversation_id, [m]);
  });
  const lastOf = (list: Message[]) =>
    list.reduce<Message | null>((acc, m) => (!acc || timeOf(m.created_at) >= timeOf(acc.created_at) ? m : acc), null);

  const rows = students.map((student) => {
    const mine = conversations.filter((c) => c.student_id === student.id);
    // Prefer this counselor's thread; otherwise the most active one.
    const ranked = mine
      .map((c) => ({ c, list: byConv.get(c.id) ?? [] }))
      .sort((a, b) => timeOf(lastOf(b.list)?.created_at) - timeOf(lastOf(a.list)?.created_at));
    const pick = ranked.find((r) => r.c.consultant_id === meId) ?? ranked[0] ?? null;
    const list = pick?.list ?? [];
    const last = lastOf(list);
    return {
      student,
      conversation: pick?.c ?? null,
      messages: list,
      last,
      awaiting: Boolean(last && last.sender_id === student.id),
    };
  });

  return rows.sort((a, b) => {
    const ta = timeOf(a.last?.created_at);
    const tb = timeOf(b.last?.created_at);
    if (ta !== tb) return tb - ta;
    return a.student.full_name.localeCompare(b.student.full_name);
  });
}

export default function CounselorMessagesPanel({ onOpenStudent, onNavigate }: CounselorPanelProps) {
  const me = useMe();
  const { students, loading: studentsLoading, error: studentsError, reload } = useStudents();
  const studentIds = useMemo(() => students.map((s) => s.id), [students]);
  const { conversations, messages, peopleById, loading: msgLoading, error: msgError, send, startConversation } =
    useMessaging(studentIds);
  const now = useNow(60_000);

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => buildRows(students, conversations, messages, me?.id), [students, conversations, messages, me?.id]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.student.full_name.toLowerCase().includes(q) || r.student.email.toLowerCase().includes(q));
  }, [rows, query]);
  const awaitingCount = rows.filter((r) => r.awaiting).length;

  // Wide screens always show a thread; small screens show it only once picked.
  const activeId = selectedId ?? rows[0]?.student.id ?? null;
  const active = rows.find((r) => r.student.id === activeId) ?? null;

  const activeStudentId = active?.student.id ?? null;
  const activeConversation = active?.conversation ?? null;
  const onSend = useCallback(
    async (text: string) => {
      if (!activeStudentId) throw new Error('Pick a student first.');
      const conversation = activeConversation ?? (await startConversation(activeStudentId));
      return send(conversation.id, text);
    },
    [activeStudentId, activeConversation, startConversation, send],
  );

  const header = (
    <PanelHeader
      index="05"
      eyebrow="Messages"
      title="Messages"
      description="Every student thread in one place. Students waiting on a reply carry a purple marker."
      actions={
        rows.length > 0 ? (
          <div className="flex items-baseline gap-3 font-mono">
            <span className={cx('text-3xl font-bold tabular-nums leading-none', awaitingCount ? 'text-portal-accent-light' : 'text-portal-dim')}>
              {pad2(awaitingCount)}
            </span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-portal-muted">Awaiting reply</span>
          </div>
        ) : undefined
      }
    />
  );

  const loadError = studentsError ?? msgError;

  if (!me || studentsLoading || msgLoading) {
    return (
      <Panel wide>
        {header}
        <LoadingBlock label="Loading messages" />
      </Panel>
    );
  }

  if (loadError) {
    return (
      <Panel wide>
        {header}
        <div role="alert" className="flex flex-col gap-4 border-l-2 border-portal-red py-2 pl-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-red">Could not load messages</p>
            <p className="mt-1 text-sm text-portal-body">{loadError}</p>
          </div>
          <Button size="sm" onClick={() => (studentsError ? reload() : window.location.reload())}>
            Try again
          </Button>
        </div>
      </Panel>
    );
  }

  if (rows.length === 0) {
    return (
      <Panel wide>
        {header}
        <EmptyState
          title="No students yet"
          body="Once students are assigned to you, their threads show up here."
          action={
            <Button variant="primary" onClick={() => onNavigate('c-students')}>
              Go to students <IconArrowRight size={14} />
            </Button>
          }
        />
      </Panel>
    );
  }

  return (
    <Panel wide>
      {header}
      <div className={FRAME}>
        {/* Student list */}
        <aside
          className={cx('min-h-0 flex-col lg:flex lg:border-r lg:border-portal-line-strong', selectedId ? 'hidden' : 'flex')}
          aria-label="Students"
        >
          <div className="flex-none border-b border-portal-line p-3">
            <label htmlFor="c-msg-search" className="sr-only">
              Search students
            </label>
            <div className="relative">
              <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-portal-dim" />
              <Input
                id="c-msg-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students"
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-portal-muted">No students match &ldquo;{query.trim()}&rdquo;.</p>
          ) : (
            <ul className="portal-scroll stagger min-h-0 flex-1 overflow-y-auto">
              {filtered.map((row) => (
                <StudentListItem
                  key={row.student.id}
                  row={row}
                  meId={me.id}
                  selected={row.student.id === activeId}
                  now={now}
                  onSelect={() => setSelectedId(row.student.id)}
                />
              ))}
            </ul>
          )}
        </aside>

        {/* Thread */}
        <section
          className={cx('min-h-0 min-w-0 flex-col lg:flex', selectedId ? 'flex' : 'hidden')}
          aria-label={active ? `Conversation with ${active.student.full_name}` : 'Conversation'}
        >
          {active ? (
            <>
              <div className="flex flex-none items-center gap-3 border-b border-portal-line px-3 py-3 sm:px-6">
                <IconButton aria-label="Back to students" className="lg:hidden" onClick={() => setSelectedId(null)}>
                  <IconArrowLeft size={16} />
                </IconButton>
                <Avatar initials={active.student.avatar_initials} size={36} tone="accent" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-base font-bold leading-tight text-portal-text">{active.student.full_name}</p>
                  <p className="truncate font-mono text-[11px] text-portal-muted">{active.student.email}</p>
                </div>
                <Button size="sm" onClick={() => onOpenStudent(active.student.id)} className="flex-none">
                  <span className="hidden sm:inline">Open portal</span>
                  <span className="sm:hidden">Portal</span>
                  <IconArrowRight size={13} />
                </Button>
              </div>
              <div className="min-h-0 flex-1">
                <ChatThread
                  key={active.student.id}
                  messages={active.messages}
                  peopleById={peopleById}
                  meId={me.id}
                  onSend={onSend}
                  emptyText={`No messages with ${active.student.full_name.split(' ')[0] || 'this student'} yet. Your first message starts the thread.`}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-portal-muted">Pick a student to open their thread.</div>
          )}
        </section>
      </div>
    </Panel>
  );
}

function StudentListItem({
  row,
  meId,
  selected,
  now,
  onSelect,
}: {
  row: StudentRow;
  meId: string;
  selected: boolean;
  now: Date;
  onSelect: () => void;
}) {
  const { student, last, awaiting } = row;
  const preview = last ? `${last.sender_id === meId ? 'You: ' : ''}${last.content.replace(/\s+/g, ' ').trim() || 'Attachment'}` : 'No messages yet';
  return (
    <li className="border-b border-portal-line">
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cx(
          'relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors',
          selected ? 'bg-portal-select' : 'hover:bg-portal-hover',
        )}
      >
        {selected && <span className="absolute inset-y-0 left-0 w-[2px] bg-portal-accent" aria-hidden="true" />}
        <Avatar initials={student.avatar_initials} size={34} tone={awaiting ? 'accent' : 'neutral'} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cx('truncate text-sm', awaiting ? 'font-semibold text-portal-text' : 'font-medium text-portal-text')}>
              {student.full_name}
            </span>
            {last && <span className="flex-none font-mono text-[10px] text-portal-dim">{timeAgo(last.created_at, now)}</span>}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={cx('min-w-0 flex-1 truncate text-xs', last ? (awaiting ? 'text-portal-body' : 'text-portal-muted') : 'text-portal-dim')}>
              {preview}
            </span>
            {awaiting && (
              <span className="inline-block h-2 w-2 flex-none bg-portal-accent" title="Awaiting your reply">
                <span className="sr-only">Awaiting your reply</span>
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}
