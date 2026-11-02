'use client';

/* ==========================================================================
   03 Essay Reviews (counselor)
   A review queue split by a vertical rule: the ruled queue on the left and
   a quiet reader on the right. Awaiting review is oldest first so nothing
   sits forever. j and k walk the queue. On small screens it shows the
   queue or the reader, with a back button.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Essay, EssayComment, EssayStatus, Profile, Prompt, School } from '@/types/database';
import { errorMessage, useApplications, useEssayVersions, useMe, useNow, useStudents } from '@/lib/hooks';
import type { CounselorPanelProps } from '../nav';
import EssayContent from '../EssayContent';
import CommentThread from '../CommentThread';
import {
  Avatar,
  Button,
  Diamond,
  EmptyState,
  IconButton,
  Input,
  Kbd,
  LineMeter,
  LoadingBlock,
  Panel,
  PanelHeader,
  SectionLabel,
  Spinner,
  StatusTag,
  cx,
  pad2,
  timeAgo,
} from '../ui/primitives';
import { IconArrowLeft, IconArrowRight, IconHistory, IconSearch } from '../ui/icons';

/* --------------------------------------------------------------------------
   Model
   -------------------------------------------------------------------------- */
type QueueTab = 'in_review' | 'revision' | 'final' | 'submitted' | 'all';

const TABS: { id: QueueTab; label: string; empty: { title: string; body: string } }[] = [
  {
    id: 'in_review',
    label: 'Awaiting review',
    empty: { title: 'Nothing waiting on you. Nice.', body: 'When a student sends a draft for review, it lands here, oldest first.' },
  },
  {
    id: 'revision',
    label: 'Revising',
    empty: { title: 'No one is revising right now.', body: 'Essays you send back for revision show up here until the student resubmits.' },
  },
  {
    id: 'final',
    label: 'Approved',
    empty: { title: 'No approved essays yet.', body: 'Essays you approve as final collect here until they are submitted.' },
  },
  {
    id: 'submitted',
    label: 'Submitted',
    empty: { title: 'Nothing submitted yet.', body: 'Once a student marks an essay as submitted, it is archived here.' },
  },
  {
    id: 'all',
    label: 'All with content',
    empty: { title: 'No essays with writing yet.', body: 'As students start drafting, every essay with words in it appears here.' },
  },
];

interface Row {
  essay: Essay;
  student: Profile | null;
  prompt: Prompt | null;
  school: School | null;
  updated: number;
}

function timeOf(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function hasContent(essay: Essay): boolean {
  if (essay.word_count > 0) return true;
  return (essay.content ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;
}

function inTab(essay: Essay, tab: QueueTab): boolean {
  if (tab === 'all') return hasContent(essay);
  return essay.status === tab;
}

function sortRows(rows: Row[], tab: QueueTab): Row[] {
  // The review queue is first in, first out; every other tab shows the latest activity first.
  const dir = tab === 'in_review' ? 1 : -1;
  return [...rows].sort((a, b) => (a.updated - b.updated) * dir || a.essay.id.localeCompare(b.essay.id));
}

function firstName(row: Row): string {
  return row.student?.full_name.split(' ')[0] || 'the student';
}

function doneNotice(row: Row, next: EssayStatus): string {
  const who = row.student?.full_name || 'The student';
  const where = row.school?.name ? ` for ${row.school.name}` : '';
  switch (next) {
    case 'revision':
      return `Revision requested. ${who} will see your notes${where}.`;
    case 'final':
      return row.essay.status === 'submitted' ? `Reopened ${firstName(row)}'s essay${where}.` : `Approved ${firstName(row)}'s essay${where} as final.`;
    case 'in_review':
      return `Moved ${firstName(row)}'s essay${where} back to review.`;
    default:
      return 'Status updated.';
  }
}

interface ActionDef {
  next: EssayStatus;
  label: string;
  pending: string;
  variant: 'primary' | 'outline';
}

function actionsFor(status: EssayStatus): ActionDef[] {
  const revise: ActionDef = { next: 'revision', label: 'Request revision', pending: 'Sending...', variant: 'outline' };
  const approve: ActionDef = { next: 'final', label: 'Approve as final', pending: 'Approving...', variant: 'primary' };
  const back: ActionDef = { next: 'in_review', label: 'Move back to review', pending: 'Moving...', variant: 'outline' };
  const reopen: ActionDef = { next: 'final', label: 'Reopen', pending: 'Reopening...', variant: 'outline' };
  switch (status) {
    case 'in_review':
      return [revise, approve];
    case 'revision':
      return [back, approve];
    case 'final':
      return [back];
    case 'submitted':
      return [reopen];
    case 'draft':
      return [approve];
    default:
      return [];
  }
}

const STATUS_NOTE: Record<EssayStatus, string> = {
  not_started: 'Nothing written yet.',
  draft: 'The student is still drafting. You can approve it or leave feedback.',
  in_review: 'Waiting on your review. Approve it, or request a revision with notes.',
  revision: 'Revision requested. The student is working on it.',
  final: 'Approved as final.',
  submitted: 'Submitted and locked. Reopen it to make changes.',
};

type ActionState = Record<string, { pending: EssayStatus | null; error: string | null }>;

const rowDomId = (essayId: string) => `review-row-${essayId}`;

const FRAME =
  'grid grid-cols-1 border-y border-portal-line-strong lg:h-[calc(100dvh-8rem)] lg:min-h-[560px] lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]';

/* --------------------------------------------------------------------------
   Panel
   -------------------------------------------------------------------------- */
export default function EssayReviewsPanel({ onOpenStudent }: CounselorPanelProps) {
  const me = useMe();
  const now = useNow(60_000);
  const { students, loading: studentsLoading, error: studentsError, reload: reloadStudents } = useStudents();
  const studentIds = useMemo(() => students.map((s) => s.id), [students]);
  const app = useApplications(studentIds);
  const { schools, prompts, essays, comments, setEssayStatus, addComment } = app;

  const [tab, setTab] = useState<QueueTab>('in_review');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileReader, setMobileReader] = useState(false);
  const [actions, setActions] = useState<ActionState>({});
  const [notice, setNotice] = useState<string | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  /* ---- Derived data ---------------------------------------------------- */
  const rows: Row[] = useMemo(() => {
    const studentById = new Map(students.map((s) => [s.id, s]));
    const promptById = new Map(prompts.map((p) => [p.id, p]));
    const schoolById = new Map(schools.map((s) => [s.id, s]));
    return essays.map((essay) => {
      const prompt = promptById.get(essay.prompt_id) ?? null;
      return {
        essay,
        student: studentById.get(essay.student_id) ?? null,
        prompt,
        school: prompt ? schoolById.get(prompt.school_id) ?? null : null,
        updated: timeOf(essay.updated_at),
      };
    });
  }, [students, prompts, schools, essays]);

  const counts = useMemo(() => {
    const c: Record<QueueTab, number> = { in_review: 0, revision: 0, final: 0, submitted: 0, all: 0 };
    rows.forEach((r) => {
      TABS.forEach((t) => {
        if (inTab(r.essay, t.id)) c[t.id] += 1;
      });
    });
    return c;
  }, [rows]);

  const oldestWaiting = useMemo(
    () =>
      rows.reduce<Row | null>(
        (oldest, r) => (r.essay.status === 'in_review' && (!oldest || r.updated < oldest.updated) ? r : oldest),
        null,
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (!inTab(r.essay, tab)) return false;
      if (!q) return true;
      return [r.student?.full_name, r.school?.name, r.prompt?.title].some((v) => v?.toLowerCase().includes(q));
    });
    return sortRows(list, tab);
  }, [rows, tab, query]);

  const commentsByEssay = useMemo(() => {
    const map = new Map<string, EssayComment[]>();
    comments.forEach((c) => {
      const list = map.get(c.essay_id);
      if (list) list.push(c);
      else map.set(c.essay_id, [c]);
    });
    return map;
  }, [comments]);

  // The selection falls back to the top of the list when it leaves the current view.
  const active = filtered.find((r) => r.essay.id === selectedId) ?? filtered[0] ?? null;
  const activeId = active?.essay.id ?? null;

  /* ---- Selection ------------------------------------------------------- */
  const select = useCallback((id: string) => {
    setSelectedId(id);
    setMobileReader(true);
    if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
      frameRef.current?.scrollIntoView({ block: 'start' });
    }
  }, []);

  const changeTab = useCallback((next: QueueTab) => {
    setTab(next);
    setMobileReader(false);
    setNotice(null);
  }, []);

  // j / k move through the queue while focus is not in a text field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'j' && e.key !== 'k') return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (filtered.length === 0) return;
      e.preventDefault();
      const idx = filtered.findIndex((r) => r.essay.id === activeId);
      const nextIdx = idx < 0 ? 0 : e.key === 'j' ? Math.min(idx + 1, filtered.length - 1) : Math.max(idx - 1, 0);
      const id = filtered[nextIdx].essay.id;
      setSelectedId(id);
      const el = document.getElementById(rowDomId(id));
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: 'nearest' });
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filtered, activeId]);

  /* ---- Mutations ------------------------------------------------------- */
  const runAction = useCallback(
    async (row: Row, next: EssayStatus) => {
      const id = row.essay.id;
      // Where to land if this essay leaves the current tab: the next one down, else the one above.
      const idx = filtered.findIndex((r) => r.essay.id === id);
      const neighbor = idx >= 0 ? (filtered[idx + 1] ?? filtered[idx - 1] ?? null)?.essay.id ?? null : null;
      const leaves = !inTab({ ...row.essay, status: next }, tab);

      setActions((a) => ({ ...a, [id]: { pending: next, error: null } }));
      setNotice(null);
      try {
        await setEssayStatus(id, next);
        setActions((a) => {
          const copy = { ...a };
          delete copy[id];
          return copy;
        });
        setNotice(doneNotice(row, next));
        if (leaves) setSelectedId((cur) => (cur === id ? neighbor : cur));
      } catch (err) {
        setActions((a) => ({ ...a, [id]: { pending: null, error: errorMessage(err) } }));
      }
    },
    [filtered, tab, setEssayStatus],
  );

  /* ---- Render ---------------------------------------------------------- */
  const header = (
    <PanelHeader
      index="03"
      eyebrow="Essay reviews"
      title="Essay Reviews"
      description="Drafts your students sent for review, oldest first. Read, leave notes, then approve or send back for revision."
      actions={
        rows.length > 0 ? (
          <div className="flex items-end gap-4">
            <div className="flex items-baseline gap-3 font-mono">
              <span className={cx('text-4xl font-bold leading-none tabular-nums', counts.in_review ? 'text-portal-amber' : 'text-portal-dim')}>
                {pad2(counts.in_review)}
              </span>
              <span className="text-[10px] uppercase tracking-[0.16em] text-portal-muted">
                Awaiting you
                {oldestWaiting && <span className="mt-1 block normal-case tracking-normal text-portal-dim">Oldest sent {timeAgo(oldestWaiting.essay.updated_at, now)}</span>}
              </span>
            </div>
          </div>
        ) : undefined
      }
    />
  );

  if (!me || studentsLoading || app.loading) {
    return (
      <Panel wide>
        {header}
        <LoadingBlock label="Loading essays" />
      </Panel>
    );
  }

  const loadError = studentsError ?? app.error;
  if (loadError) {
    return (
      <Panel wide>
        {header}
        <div role="alert" className="flex flex-col gap-4 border-l-2 border-portal-red py-2 pl-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-red">Could not load essays</p>
            <p className="mt-1 text-sm text-portal-body">{loadError}</p>
          </div>
          <Button size="sm" onClick={() => (studentsError ? reloadStudents() : app.reload())}>
            Try again
          </Button>
        </div>
      </Panel>
    );
  }

  if (students.length === 0) {
    return (
      <Panel wide>
        {header}
        <EmptyState title="No students yet" body="Once students are assigned to you, the drafts they send for review show up here." />
      </Panel>
    );
  }

  const tabMeta = TABS.find((t) => t.id === tab) ?? TABS[0];
  const activeAction = activeId ? actions[activeId] : undefined;

  return (
    <Panel wide>
      {header}

      {/* Tabs */}
      <nav aria-label="Review queues" className="mb-4 flex flex-wrap gap-x-6 gap-y-1 border-b border-portal-line">
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => changeTab(t.id)}
              aria-pressed={on}
              className={cx(
                'relative -mb-px flex h-10 items-center gap-2 border-b-2 text-sm transition-colors',
                on ? 'border-portal-accent text-portal-text' : 'border-transparent text-portal-muted hover:text-portal-text',
              )}
            >
              {t.label}
              <span className={cx('font-mono text-[11px] tabular-nums', on ? 'text-portal-accent-light' : 'text-portal-dim')}>{counts[t.id]}</span>
            </button>
          );
        })}
      </nav>

      <div role="status" aria-live="polite" className={cx('min-h-0', notice && 'mb-4')}>
        {notice && (
          <p className="animate-rise flex items-center gap-3 border-l-2 border-portal-green py-1 pl-4 text-sm text-portal-body">
            <Diamond size={6} color="var(--color-portal-green)" />
            {notice}
          </p>
        )}
      </div>

      <div ref={frameRef} className={FRAME}>
        {/* Queue */}
        <aside
          aria-label="Review queue"
          className={cx('min-h-0 flex-col lg:flex lg:border-r lg:border-portal-line-strong', mobileReader ? 'hidden' : 'flex')}
        >
          <div className="flex-none border-b border-portal-line p-3">
            <label htmlFor="review-search" className="sr-only">
              Search essays
            </label>
            <div className="relative">
              <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-portal-dim" />
              <Input
                id="review-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Student, school or prompt"
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            query.trim() ? (
              <p className="px-4 py-6 text-sm text-portal-muted">No essays match &ldquo;{query.trim()}&rdquo;.</p>
            ) : (
              <div className="p-4">
                <EmptyState title={tabMeta.empty.title} body={tabMeta.empty.body} />
              </div>
            )
          ) : (
            <ul className="portal-scroll stagger min-h-0 flex-1 lg:overflow-y-auto" key={tab}>
              {filtered.map((row) => (
                <QueueItem
                  key={row.essay.id}
                  row={row}
                  selected={row.essay.id === activeId}
                  pending={Boolean(actions[row.essay.id]?.pending)}
                  now={now}
                  onSelect={() => select(row.essay.id)}
                />
              ))}
            </ul>
          )}

          {filtered.length > 1 && (
            <p className="hidden flex-none items-center gap-2 border-t border-portal-line px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-portal-dim lg:flex">
              <Kbd>j</Kbd>
              <Kbd>k</Kbd>
              to move
            </p>
          )}
        </aside>

        {/* Reader */}
        <section
          aria-label={active ? `Essay by ${active.student?.full_name ?? 'student'}` : 'Essay'}
          className={cx('min-h-0 min-w-0 flex-col lg:flex', mobileReader ? 'flex' : 'hidden')}
        >
          {active && me ? (
            <Reader
              key={active.essay.id}
              row={active}
              meId={me.id}
              now={now}
              comments={commentsByEssay.get(active.essay.id) ?? []}
              pending={activeAction?.pending ?? null}
              error={activeAction?.error ?? null}
              onAction={(next) => void runAction(active, next)}
              onAddComment={(text) => addComment(active.essay.id, text)}
              onBack={() => setMobileReader(false)}
              onOpenStudent={() =>
                onOpenStudent(active.essay.student_id, 'schools', {
                  schoolId: active.school?.id,
                  promptId: active.prompt?.id ?? active.essay.prompt_id,
                })
              }
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <span className="relative h-8 w-8" aria-hidden="true">
                <span className="absolute inset-0 rotate-45 border border-portal-line-strong" />
              </span>
              <p className="text-sm text-portal-muted">Pick an essay from the queue to read it here.</p>
              <Button size="sm" variant="ghost" className="lg:hidden" onClick={() => setMobileReader(false)}>
                <IconArrowLeft size={13} /> Back to queue
              </Button>
            </div>
          )}
        </section>
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
   Queue item
   -------------------------------------------------------------------------- */
function QueueItem({
  row,
  selected,
  pending,
  now,
  onSelect,
}: {
  row: Row;
  selected: boolean;
  pending: boolean;
  now: Date;
  onSelect: () => void;
}) {
  const { essay, student, school, prompt } = row;
  const limit = prompt?.word_limit ?? 0;
  const over = limit > 0 && essay.word_count > limit;
  return (
    <li className="border-b border-portal-line">
      <button
        id={rowDomId(essay.id)}
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cx(
          'relative flex w-full flex-col gap-1 px-4 py-3.5 text-left transition-colors',
          selected ? 'bg-portal-select' : 'hover:bg-portal-hover',
        )}
      >
        {selected && <span className="absolute inset-y-0 left-0 w-[2px] bg-portal-accent" aria-hidden="true" />}
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-medium text-portal-text">{student?.full_name ?? 'Unknown student'}</span>
          <span className="flex-none font-mono text-[10px] text-portal-dim">{timeAgo(essay.updated_at, now)}</span>
        </span>
        <span className="truncate text-xs text-portal-body">{school?.name ?? 'School removed'}</span>
        <span className="truncate text-xs text-portal-muted">{prompt?.title ?? 'Untitled prompt'}</span>
        <span className="mt-1.5 flex items-center justify-between gap-3">
          {pending ? <Spinner label="Saving" /> : <StatusTag status={essay.status} />}
          <span className={cx('flex-none font-mono text-[10px] tabular-nums', over ? 'text-portal-red' : 'text-portal-dim')}>
            {essay.word_count}
            {limit > 0 && ` / ${limit}`}
            <span className="sr-only">{over ? ' words, over the limit' : ' words'}</span>
          </span>
        </span>
      </button>
    </li>
  );
}

/* --------------------------------------------------------------------------
   Reader
   -------------------------------------------------------------------------- */
function Reader({
  row,
  meId,
  now,
  comments,
  pending,
  error,
  onAction,
  onAddComment,
  onBack,
  onOpenStudent,
}: {
  row: Row;
  meId: string;
  now: Date;
  comments: EssayComment[];
  pending: EssayStatus | null;
  error: string | null;
  onAction: (next: EssayStatus) => void;
  onAddComment: (text: string) => Promise<unknown>;
  onBack: () => void;
  onOpenStudent: () => void;
}) {
  const { essay, student, school, prompt } = row;
  const limit = prompt?.word_limit ?? 0;
  const over = limit > 0 ? essay.word_count - limit : 0;
  const actions = actionsFor(essay.status);
  const busy = pending !== null;

  return (
    <div className="portal-scroll animate-rise min-h-0 flex-1 lg:overflow-y-auto">
      {/* Who and what */}
      <div className="flex items-start gap-3 border-b border-portal-line px-3 py-4 sm:px-6 lg:px-8">
        <IconButton aria-label="Back to queue" className="lg:hidden" onClick={onBack}>
          <IconArrowLeft size={16} />
        </IconButton>
        <Avatar initials={student?.avatar_initials ?? '?'} size={36} tone="accent" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-lg font-bold leading-tight text-portal-text">{student?.full_name ?? 'Unknown student'}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-[0.12em] text-portal-muted">{school?.name ?? 'School removed'}</p>
        </div>
        <Button size="sm" onClick={onOpenStudent} className="flex-none">
          <span className="hidden sm:inline">Open in student portal</span>
          <span className="sm:hidden">Portal</span>
          <IconArrowRight size={13} />
        </Button>
      </div>

      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[68ch]">
          {/* Prompt */}
          <h2 className="font-serif text-2xl font-bold leading-snug text-portal-text">{prompt?.title ?? 'Untitled prompt'}</h2>
          {prompt?.prompt_text && (
            <blockquote className="mt-4 whitespace-pre-line border-l-2 border-portal-line-strong pl-4 font-serif text-[15px] italic leading-relaxed text-portal-muted">
              {prompt.prompt_text}
            </blockquote>
          )}

          {/* Status + actions */}
          <div className="mt-8 border-y border-portal-line py-4">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <StatusTag status={essay.status} />
                <p className="mt-1.5 text-sm text-portal-muted">{STATUS_NOTE[essay.status]}</p>
              </div>
              {actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {actions.map((a) => (
                    <Button key={a.label} size="sm" variant={a.variant} disabled={busy} onClick={() => onAction(a.next)}>
                      {pending === a.next ? a.pending : a.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            {error && (
              <p role="alert" className="mt-3 border-l-2 border-portal-red pl-3 text-sm text-portal-red">
                Could not update the status. {error}
              </p>
            )}
          </div>

          {/* Essay */}
          <EssayBody essay={essay} now={now} />

          {/* Word count */}
          <div className="mt-8">
            <div className="mb-2 flex items-baseline justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.16em]">
              <span className="text-portal-muted">Word count</span>
              <span className={cx('tabular-nums', over > 0 ? 'text-portal-red' : 'text-portal-body')}>
                {essay.word_count}
                {limit > 0 && ` / ${limit}`}
              </span>
            </div>
            {limit > 0 && <LineMeter value={essay.word_count} max={limit} />}
            {over > 0 && (
              <p className="mt-2 text-xs text-portal-red">
                {over} {over === 1 ? 'word' : 'words'} over the {limit} word limit.
              </p>
            )}
          </div>

          {/* Feedback */}
          <section className="mt-12" aria-label="Feedback">
            <SectionLabel>Feedback {comments.length > 0 && <span className="text-portal-dim">({comments.length})</span>}</SectionLabel>
            <CommentThread
              comments={comments}
              viewerId={meId}
              onAdd={onAddComment}
              placeholder={`Leave a note for ${student?.full_name.split(' ')[0] || 'the student'}...`}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Essay body with "compare with previous version"
   -------------------------------------------------------------------------- */
const ESSAY_TEXT = 'text-[17px] leading-[1.85] text-portal-body';

function EssayBody({ essay, now }: { essay: Essay; now: Date }) {
  const { versions, loading, error } = useEssayVersions(essay.id);
  const [compare, setCompare] = useState(false);

  // The most recent saved version that differs from what is on screen now.
  const previous = useMemo(() => versions.find((v) => v.content !== essay.content) ?? null, [versions, essay.content]);
  const showCompare = compare && previous !== null;

  return (
    <div className="mt-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">
          {showCompare ? 'Previous and current' : 'Current draft'}
        </span>
        {loading ? (
          <Spinner label="Checking versions" />
        ) : error ? (
          <span role="alert" className="text-xs text-portal-red">
            Versions unavailable. {error}
          </span>
        ) : previous ? (
          <Button size="sm" variant={compare ? 'outline' : 'ghost'} aria-pressed={compare} onClick={() => setCompare((c) => !c)}>
            <IconHistory size={13} />
            {compare ? 'Hide previous version' : 'Compare with previous version'}
          </Button>
        ) : (
          <span className="font-mono text-[10px] text-portal-dim">No earlier version saved</span>
        )}
      </div>

      {showCompare && previous ? (
        <div className="grid gap-8 xl:grid-cols-2 xl:gap-0">
          <div className="min-w-0 xl:border-r xl:border-portal-line xl:pr-6">
            <p className="mb-3 flex items-center gap-2 border-b border-portal-line pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-portal-dim">
              <Diamond size={6} filled={false} />
              Previous, saved {timeAgo(previous.created_at, now)}
              <span className="ml-auto tabular-nums">{previous.word_count} words</span>
            </p>
            <EssayContent html={previous.content} className={cx(ESSAY_TEXT, 'opacity-80')} />
          </div>
          <div className="min-w-0 xl:pl-6">
            <p className="mb-3 flex items-center gap-2 border-b border-portal-line pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-portal-accent-light">
              <Diamond size={6} />
              Current, updated {timeAgo(essay.updated_at, now)}
              <span className="ml-auto tabular-nums text-portal-dim">{essay.word_count} words</span>
            </p>
            <EssayContent html={essay.content} className={ESSAY_TEXT} />
          </div>
        </div>
      ) : (
        <EssayContent html={essay.content} className={ESSAY_TEXT} />
      )}
    </div>
  );
}
