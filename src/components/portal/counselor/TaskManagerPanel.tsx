'use client';

/* ==========================================================================
   Task manager (counselor): assign one task to several students at once,
   read every student's workload on a status board matrix, then work the
   ruled list below grouped by student or by due date.
   ========================================================================== */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { TASK_CATEGORIES, errorMessage, useNow, useStudents, useTasks } from '@/lib/hooks';
import type { Profile, Task } from '@/types/database';
import type { CounselorPanelProps } from '../nav';
import {
  Avatar,
  Button,
  Checkbox,
  Diamond,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  LoadingBlock,
  Panel,
  PanelHeader,
  SectionLabel,
  Select,
  Tag,
  cx,
  daysUntil,
  formatDate,
  pad2,
  parseDate,
  relativeDays,
  toneColor,
} from '../ui/primitives';
import type { Tone } from '../ui/primitives';
import { IconArrowRight, IconClose, IconEdit, IconPlus, IconSearch, IconTrash } from '../ui/icons';

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

type BucketId = 'overdue' | 'week' | 'later' | 'none' | 'done';
type StatusFilter = 'all' | 'open' | 'overdue' | 'done';
type GroupMode = 'student' | 'date';

const BUCKETS: { id: BucketId; label: string; short: string; tone: Tone; hint: string }[] = [
  { id: 'overdue', label: 'Overdue', short: 'Late', tone: 'red', hint: 'Open tasks past their due date' },
  { id: 'week', label: 'This week', short: 'Week', tone: 'amber', hint: 'Open tasks due today or in the next 7 days' },
  { id: 'later', label: 'Later', short: 'Later', tone: 'accent', hint: 'Open tasks due more than a week from now' },
  { id: 'none', label: 'No date', short: 'None', tone: 'neutral', hint: 'Open tasks without a due date' },
  { id: 'done', label: 'Done', short: 'Done', tone: 'green', hint: 'Completed tasks' },
];

const BUCKET_META = Object.fromEntries(BUCKETS.map((b) => [b.id, b])) as Record<BucketId, (typeof BUCKETS)[number]>;

const STATUS_FILTERS: { id: StatusFilter; label: string; tone: Tone }[] = [
  { id: 'all', label: 'All', tone: 'accent' },
  { id: 'open', label: 'Open', tone: 'accent' },
  { id: 'overdue', label: 'Overdue', tone: 'red' },
  { id: 'done', label: 'Done', tone: 'green' },
];

const CATEGORY_TONE: Record<string, Tone> = {
  Essays: 'blue',
  Applications: 'accent',
  Testing: 'amber',
  Recommendations: 'gold',
  Activities: 'green',
  Research: 'blue',
  'Financial Aid': 'gold',
  General: 'neutral',
};

const MATRIX_PREVIEW = 10;
const BAR_SQUARES = 5;

function toneFor(category: string): Tone {
  return CATEGORY_TONE[category] ?? 'neutral';
}

/** The DB types due_date as string, but the column is nullable. */
function dueOf(task: Task): string | null {
  return task.due_date || null;
}

/** Local YYYY-MM-DD for a task's due date, or null (never via toISOString). */
function dueKey(task: Task): string | null {
  const d = parseDate(dueOf(task));
  return d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : null;
}

function bucketOf(task: Task, now: Date): BucketId {
  if (task.completed) return 'done';
  const n = daysUntil(dueOf(task), now);
  if (n === null) return 'none';
  if (n < 0) return 'overdue';
  if (n <= 7) return 'week';
  return 'later';
}

function matchesStatus(task: Task, status: StatusFilter, now: Date): boolean {
  if (status === 'open') return !task.completed;
  if (status === 'done') return task.completed;
  if (status === 'overdue') return bucketOf(task, now) === 'overdue';
  return true;
}

/** Open before done, then by due date (no date last), then title. */
function compareTasks(a: Task, b: Task): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  const ka = dueKey(a);
  const kb = dueKey(b);
  if (ka && kb && ka !== kb) return ka < kb ? -1 : 1;
  if (ka && !kb) return -1;
  if (!ka && kb) return 1;
  return a.title.localeCompare(b.title);
}

function nameOf(student: Profile | undefined): string {
  return student?.full_name?.trim() || student?.email || 'Unnamed student';
}

function initialsOf(student: Profile | undefined): string {
  if (student?.avatar_initials) return student.avatar_initials;
  return nameOf(student)
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2);
}

function emptyCounts(): Record<BucketId, number> {
  return { overdue: 0, week: 0, later: 0, none: 0, done: 0 };
}

/** Same wording as relativeDays, but driven by the shared `now` tick. */
function relativeLabel(n: number): string {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `In ${n} days` : `${Math.abs(n)} days ago`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

const microLabel = 'font-mono text-[10px] uppercase tracking-[0.16em]';

/* --------------------------------------------------------------------------
   Assign form (inline, ruled)
   -------------------------------------------------------------------------- */

interface AssignInput {
  title: string;
  category: string;
  due_date: string | null;
}

type AssignResult = { studentId: string; error: string | null };

function AssignForm({
  students,
  initialSelected,
  onAssign,
  onClose,
}: {
  students: Profile[];
  initialSelected: string[];
  onAssign: (studentIds: string[], input: AssignInput) => Promise<AssignResult[]>;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('General');
  const [due, setDue] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => nameOf(s).toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [students, search]);
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.id));

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of visible) {
        if (allVisibleSelected) next.delete(s.id);
        else next.add(s.id);
      }
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setNotice(null);
    if (selected.size === 0) {
      setError('Pick at least one student.');
      return;
    }
    if (!title.trim()) {
      setError('Give the task a title.');
      titleRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    // Keep the order the counselor sees in the picker.
    const ids = students.filter((s) => selected.has(s.id)).map((s) => s.id);
    try {
      const results = await onAssign(ids, { title: title.trim(), category, due_date: due || null });
      const failed = results.filter((r) => r.error);
      const ok = results.length - failed.length;
      if (failed.length === 0) {
        setNotice(`Assigned "${title.trim()}" to ${plural(ok, 'student')}.`);
        setTitle('');
        setDue('');
        setSelected(new Set());
        titleRef.current?.focus();
      } else {
        // Keep only the students that failed selected so a retry is one click.
        setSelected(new Set(failed.map((f) => f.studentId)));
        const messages = [...new Set(failed.map((f) => f.error))];
        const who = failed.map((f) => nameOf(byId.get(f.studentId))).join(', ');
        setError(
          `${ok > 0 ? `Assigned to ${ok} of ${results.length}. ` : ''}Could not assign to ${who}: ${messages.join(' ')} They are still selected so you can try again.`,
        );
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const count = selected.size;

  return (
    <form onSubmit={submit} aria-label="Assign a task" className="animate-rise mb-12 border-y border-portal-line-strong">
      <div className="flex items-center gap-3 border-b border-portal-line py-3">
        <Diamond size={7} />
        <h2 className={cx(microLabel, 'text-[11px] tracking-[0.18em] text-portal-accent-light')}>Assign a task</h2>
        <span className="h-px flex-1 bg-portal-line" />
        <IconButton aria-label="Close the assign form" onClick={onClose} disabled={pending}>
          <IconClose size={14} />
        </IconButton>
      </div>

      <div className="grid md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:divide-x md:divide-portal-line">
        {/* Student picker */}
        <fieldset className="min-w-0 border-b border-portal-line py-5 md:border-b-0 md:pr-6" disabled={pending}>
          <legend className="sr-only">Students</legend>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className={cx(microLabel, 'text-portal-muted')}>Students</span>
            <span className={cx(microLabel, count ? 'text-portal-accent-light' : 'text-portal-dim')}>{pad2(count)} selected</span>
          </div>
          <div className="relative">
            <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-portal-dim" />
            <Input
              aria-label="Search students"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students"
              className="pl-9"
              autoComplete="off"
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <Button size="sm" variant="ghost" onClick={toggleAllVisible} disabled={visible.length === 0} className="-ml-3">
              {allVisibleSelected ? 'Clear these' : search.trim() ? `Select matches (${visible.length})` : `Select all (${visible.length})`}
            </Button>
            {count > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="-mr-3">
                Clear all
              </Button>
            )}
          </div>
          <ul className="portal-scroll mt-1 max-h-60 overflow-y-auto border-t border-portal-line">
            {visible.length === 0 && <li className="py-4 text-sm text-portal-dim">No student matches &ldquo;{search.trim()}&rdquo;.</li>}
            {visible.map((s) => {
              const on = selected.has(s.id);
              return (
                <li key={s.id} className="border-b border-portal-line">
                  <label
                    className={cx(
                      'flex min-h-10 cursor-pointer items-center gap-3 px-1 transition-colors',
                      on ? 'bg-portal-select' : 'hover:bg-portal-hover',
                    )}
                  >
                    <Checkbox checked={on} onChange={(v) => toggle(s.id, v)} label={nameOf(s)} />
                    <span className={cx('min-w-0 flex-1 truncate text-sm', on ? 'text-portal-text' : 'text-portal-body')}>{nameOf(s)}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        {/* Task details */}
        <div className="grid content-start gap-5 py-5 md:pl-6">
          <Field label="Task" htmlFor="tm-assign-title">
            <Input
              id="tm-assign-title"
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Request a recommendation from your English teacher"
              maxLength={200}
              disabled={pending}
              autoComplete="off"
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Category" htmlFor="tm-assign-category">
              <Select id="tm-assign-category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={pending}>
                {TASK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due date (optional)" htmlFor="tm-assign-due" hint={due ? relativeDays(due) : 'Leave empty for no due date'}>
              <div className="flex gap-2">
                <Input id="tm-assign-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} disabled={pending} />
                {due && (
                  <Button variant="ghost" onClick={() => setDue('')} disabled={pending}>
                    Clear
                  </Button>
                )}
              </div>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-portal-line pt-5">
            <Button type="submit" variant="primary" disabled={pending}>
              <IconPlus size={14} />
              {pending ? 'Assigning' : count > 1 ? `Assign to ${count} students` : count === 1 ? 'Assign to 1 student' : 'Assign'}
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              Done
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-portal-red">
              {error}
            </p>
          )}
          {notice && !error && (
            <p role="status" className="flex items-center gap-2 text-sm text-portal-green">
              <Diamond size={6} color={toneColor.green} />
              {notice}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}

/* --------------------------------------------------------------------------
   Status board matrix (signature)
   -------------------------------------------------------------------------- */

interface BoardRow {
  student: Profile;
  counts: Record<BucketId, number>;
}

function MatrixCell({
  count,
  bucket,
  active,
  lit,
  label,
  onClick,
  onHover,
}: {
  count: number;
  bucket: BucketId;
  active: boolean;
  lit: boolean;
  label: string;
  onClick: () => void;
  onHover: () => void;
}) {
  const meta = BUCKET_META[bucket];
  const color = toneColor[meta.tone];
  const squares = Math.min(count, BAR_SQUARES);
  return (
    <td className={cx('relative border-l border-portal-line p-0', lit && !active && 'bg-portal-hover', active && 'bg-portal-select')}>
      {active && <span className="absolute inset-x-0 top-0 h-[2px] bg-portal-accent-light" aria-hidden="true" />}
      <button
        type="button"
        aria-pressed={active}
        aria-label={label}
        title={label}
        disabled={count === 0 && !active}
        onClick={onClick}
        onMouseEnter={onHover}
        onFocus={onHover}
        className="group flex h-11 w-full items-center justify-between gap-1 px-1.5 text-left disabled:cursor-default sm:px-3"
      >
        <span
          className="font-mono text-sm tabular-nums transition-colors"
          style={{ color: count === 0 ? 'var(--color-portal-dim)' : meta.tone === 'neutral' ? 'var(--color-portal-body)' : color }}
        >
          {pad2(count)}
        </span>
        <span className="hidden items-center gap-[2px] sm:flex" aria-hidden="true">
          {Array.from({ length: squares }, (_, i) => (
            <span
              key={i}
              className="h-1 w-1 transition-transform duration-200 group-hover:scale-125"
              style={{ background: color, transitionDelay: `${i * 20}ms` }}
            />
          ))}
          {count > BAR_SQUARES && <span className="font-mono text-[9px] leading-none text-portal-muted">+</span>}
        </span>
      </button>
    </td>
  );
}

function StatusBoard({
  rows,
  totals,
  studentFilter,
  bucket,
  onPick,
}: {
  rows: BoardRow[];
  totals: Record<BucketId, number>;
  studentFilter: string;
  bucket: BucketId | null;
  onPick: (studentId: string, bucket: BucketId | null) => void;
}) {
  const [hover, setHover] = useState<{ row: string | null; col: BucketId | null }>({ row: null, col: null });
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, MATRIX_PREVIEW);
  const hidden = rows.length - shown.length;

  return (
    <section aria-label="Status board" className="animate-rise mb-12">
      <SectionLabel>Status board</SectionLabel>
      <table className="w-full table-fixed border-collapse border-y border-portal-line-strong" onMouseLeave={() => setHover({ row: null, col: null })}>
        <caption className="sr-only">Open and completed tasks per student, by due date. Choose a cell to filter the list below.</caption>
        <colgroup>
          <col />
          {BUCKETS.map((b) => (
            <col key={b.id} className="w-[2.75rem] sm:w-[5.5rem] lg:w-[7rem]" />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-portal-line-strong">
            <th scope="col" className={cx(microLabel, 'py-2.5 pr-2 text-left font-normal text-portal-dim')}>
              Student
            </th>
            {BUCKETS.map((b) => {
              const active = bucket === b.id && studentFilter === 'all';
              const lit = hover.col === b.id;
              return (
                <th key={b.id} scope="col" className={cx('border-l border-portal-line p-0 font-normal', lit && 'bg-portal-hover')}>
                  <button
                    type="button"
                    title={b.hint}
                    aria-pressed={active}
                    onClick={() => onPick('all', active ? null : b.id)}
                    onMouseEnter={() => setHover({ row: null, col: b.id })}
                    className={cx(
                      microLabel,
                      'flex h-9 w-full items-center gap-1.5 px-1.5 text-left transition-colors hover:text-portal-text sm:px-3',
                      active ? 'text-portal-text' : 'text-portal-muted',
                    )}
                  >
                    <span className="hidden h-1.5 w-1.5 flex-none sm:block" style={{ background: toneColor[b.tone] }} aria-hidden="true" />
                    <span className="truncate sm:hidden">{b.short}</span>
                    <span className="hidden truncate sm:inline">{b.label}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shown.map(({ student, counts }) => {
            const rowActive = studentFilter === student.id;
            const lit = hover.row === student.id;
            const name = nameOf(student);
            return (
              <tr key={student.id} className="border-b border-portal-line">
                <th scope="row" className={cx('p-0 text-left font-normal', (lit || rowActive) && 'bg-portal-hover')}>
                  <button
                    type="button"
                    aria-pressed={rowActive && bucket === null}
                    onClick={() => onPick(rowActive && bucket === null ? 'all' : student.id, null)}
                    onMouseEnter={() => setHover({ row: student.id, col: null })}
                    title={`Show all of ${name}'s tasks`}
                    className="flex h-11 w-full min-w-0 items-center gap-2.5 pr-2 text-left"
                  >
                    {rowActive && <span className="h-full w-[2px] flex-none bg-portal-accent-light" aria-hidden="true" />}
                    <span className="hidden sm:inline-flex">
                      <Avatar initials={initialsOf(student)} size={24} tone={counts.overdue > 0 ? 'red' : 'accent'} />
                    </span>
                    <span className={cx('min-w-0 truncate text-sm', rowActive ? 'text-portal-text' : 'text-portal-body')}>{name}</span>
                  </button>
                </th>
                {BUCKETS.map((b) => {
                  const active = rowActive && bucket === b.id;
                  return (
                    <MatrixCell
                      key={b.id}
                      count={counts[b.id]}
                      bucket={b.id}
                      active={active}
                      lit={lit || hover.col === b.id}
                      label={`${name}: ${counts[b.id]} ${b.label.toLowerCase()}`}
                      onClick={() => onPick(active ? 'all' : student.id, active ? null : b.id)}
                      onHover={() => setHover({ row: student.id, col: b.id })}
                    />
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-portal-line-strong">
            <th scope="row" className={cx(microLabel, 'py-3 pr-2 text-left font-normal text-portal-muted')}>
              All students
            </th>
            {BUCKETS.map((b) => (
              <td
                key={b.id}
                className={cx(
                  'border-l border-portal-line px-1.5 py-3 font-mono text-base font-bold tabular-nums sm:px-3 sm:text-lg',
                  hover.col === b.id && 'bg-portal-hover',
                )}
                style={{ color: totals[b.id] === 0 ? 'var(--color-portal-dim)' : b.tone === 'neutral' ? 'var(--color-portal-text)' : toneColor[b.tone] }}
              >
                {pad2(totals[b.id])}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      {(hidden > 0 || expanded) && rows.length > MATRIX_PREVIEW && (
        <Button size="sm" variant="ghost" className="-ml-3 mt-2" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show fewer students' : `Show all ${rows.length} students`}
        </Button>
      )}
    </section>
  );
}

/* --------------------------------------------------------------------------
   Edit and delete dialogs
   -------------------------------------------------------------------------- */

function EditTaskDialog({
  task,
  studentName,
  onClose,
  onSave,
}: {
  task: Task;
  studentName: string;
  onClose: () => void;
  onSave: (updates: AssignInput) => Promise<unknown>;
}) {
  const [title, setTitle] = useState(task.title);
  const [category, setCategory] = useState(task.category || 'General');
  const [due, setDue] = useState(dueKey(task) ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  // Escape and the backdrop must not close the dialog mid-save: a failed save rolls back
  // the optimistic update, and the error would have nowhere to show.
  const guardedClose = useCallback(() => {
    if (!pendingRef.current) onClose();
  }, [onClose]);

  const categories: string[] = (TASK_CATEGORIES as readonly string[]).includes(category)
    ? [...TASK_CATEGORIES]
    : [...TASK_CATEGORIES, category];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (pendingRef.current) return;
    if (!title.trim()) {
      setError('Give the task a title.');
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await onSave({ title: title.trim(), category, due_date: due || null });
      pendingRef.current = false;
      onClose();
    } catch (err) {
      pendingRef.current = false;
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      onClose={guardedClose}
      title="Edit task"
      footer={
        <>
          <Button variant="ghost" onClick={guardedClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="tm-edit-form" variant="primary" disabled={pending}>
            {pending ? 'Saving' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="tm-edit-form" onSubmit={save} className="grid gap-5">
        <p className={cx(microLabel, 'text-portal-dim')}>For {studentName}</p>
        <Field label="Task" htmlFor="tm-edit-title">
          <Input id="tm-edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={pending} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" htmlFor="tm-edit-category">
            <Select id="tm-edit-category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={pending}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date" htmlFor="tm-edit-due" hint={due ? relativeDays(due) : 'No due date'}>
            <div className="flex gap-2">
              <Input id="tm-edit-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} disabled={pending} />
              <Button variant="ghost" onClick={() => setDue('')} disabled={pending || !due}>
                Clear
              </Button>
            </div>
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-sm text-portal-red">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

function DeleteTaskDialog({
  task,
  studentName,
  onClose,
  onDelete,
}: {
  task: Task;
  studentName: string;
  onClose: () => void;
  onDelete: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const guardedClose = useCallback(() => {
    if (!pendingRef.current) onClose();
  }, [onClose]);

  async function confirmDelete() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await onDelete();
      pendingRef.current = false;
      onClose();
    } catch (err) {
      pendingRef.current = false;
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      onClose={guardedClose}
      title="Delete this task?"
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={guardedClose} disabled={pending}>
            Keep it
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={pending}>
            <IconTrash size={14} />
            {pending ? 'Deleting' : 'Delete task'}
          </Button>
        </>
      }
    >
      <p className="font-serif text-base text-portal-text">{task.title}</p>
      <p className="mt-2 text-sm text-portal-muted">
        This removes it from {studentName}&rsquo;s task list too. It cannot be undone.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-portal-red">
          {error}
        </p>
      )}
    </Dialog>
  );
}

/* --------------------------------------------------------------------------
   Rows and sections
   -------------------------------------------------------------------------- */

function TaskRow({
  task,
  now,
  studentName,
  pending,
  error,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  now: Date;
  /** Shown when the list is grouped by date. */
  studentName?: string;
  pending: boolean;
  error: string | null;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const bucket = bucketOf(task, now);
  const overdue = bucket === 'overdue';
  const due = dueOf(task);
  const n = daysUntil(due, now);
  const dueText = due ? `${formatDate(due)}${task.completed || n === null ? '' : `, ${relativeLabel(n).toLowerCase()}`}` : 'No date';

  return (
    <li className="group relative border-b border-portal-line">
      {overdue && <span className="absolute inset-y-0 left-0 w-[2px] bg-portal-red" aria-hidden="true" />}
      <div className="flex items-start gap-2 py-2.5 pl-2 pr-1 transition-colors duration-150 group-hover:bg-portal-hover sm:items-center sm:gap-3">
        <label className={cx('flex h-8 w-8 flex-none cursor-pointer items-center justify-center', pending && 'pointer-events-none opacity-50')}>
          <Checkbox
            checked={task.completed}
            onChange={() => onToggle()}
            label={task.completed ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
          />
        </label>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1.5 sm:flex-row sm:items-center sm:gap-4 sm:pt-0">
          <span className="min-w-0 flex-1">
            <span
              className={cx(
                'block break-words text-[15px] leading-snug transition-colors',
                task.completed ? 'text-portal-dim line-through decoration-portal-dim' : 'text-portal-text',
              )}
            >
              {task.title}
            </span>
            {studentName && <span className={cx(microLabel, 'mt-1 block truncate text-portal-muted')}>{studentName}</span>}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Tag tone={task.completed ? 'neutral' : toneFor(task.category)}>{task.category || 'General'}</Tag>
            <span
              className={cx(
                'whitespace-nowrap font-mono text-[11px] tabular-nums sm:w-36 sm:text-right',
                overdue
                  ? 'text-portal-red'
                  : task.completed || n === null
                    ? 'text-portal-dim'
                    : n === 0
                      ? 'text-portal-accent-light'
                      : 'text-portal-muted',
              )}
            >
              {dueText}
            </span>
          </span>
        </div>
        <div className="flex w-16 flex-none justify-end">
          <IconButton aria-label={`Edit "${task.title}"`} onClick={onEdit}>
            <IconEdit size={15} />
          </IconButton>
          <IconButton aria-label={`Delete "${task.title}"`} tone="danger" onClick={onDelete}>
            <IconTrash size={15} />
          </IconButton>
        </div>
      </div>
      {error && (
        <p role="alert" className="px-12 pb-2.5 text-xs text-portal-red">
          {error}
        </p>
      )}
    </li>
  );
}

interface Section {
  key: string;
  tasks: Task[];
  student?: Profile;
  bucket?: BucketId;
}

/* --------------------------------------------------------------------------
   Panel
   -------------------------------------------------------------------------- */

export default function TaskManagerPanel({ onOpenStudent }: CounselorPanelProps) {
  const { students: rawStudents, loading: studentsLoading, error: studentsError, reload: reloadStudents } = useStudents();
  const students = useMemo(() => [...rawStudents].sort((a, b) => nameOf(a).localeCompare(nameOf(b))), [rawStudents]);
  const studentIds = useMemo(() => students.map((s) => s.id), [students]);
  const { tasks, loading: tasksLoading, error: tasksError, reload: reloadTasks, addTask, updateTask, toggleTask, deleteTask } =
    useTasks(studentIds);
  const now = useNow();

  const [assignOpen, setAssignOpen] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [bucket, setBucket] = useState<BucketId | null>(null);
  const [studentFilterRaw, setStudentFilter] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<GroupMode>('student');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const listRef = useRef<HTMLElement>(null);
  /** In-flight toggles, read synchronously so a double click cannot fire two updates. */
  const inFlight = useRef<Set<string>>(new Set());

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  // A student who leaves the roster must not leave the list stuck on an empty filter.
  const studentFilter = studentFilterRaw === 'all' || byId.has(studentFilterRaw) ? studentFilterRaw : 'all';

  const categories = useMemo(() => {
    const extra = [...new Set(tasks.map((t) => t.category).filter((c) => c && !(TASK_CATEGORIES as readonly string[]).includes(c)))];
    return [...TASK_CATEGORIES, ...extra.sort()];
  }, [tasks]);

  /* Matrix: every student, counts respect the category filter only. */
  const board = useMemo(() => {
    const counts = new Map<string, Record<BucketId, number>>(students.map((s) => [s.id, emptyCounts()]));
    const totals = emptyCounts();
    for (const t of tasks) {
      if (category !== 'all' && t.category !== category) continue;
      const row = counts.get(t.student_id);
      if (!row) continue;
      const b = bucketOf(t, now);
      row[b] += 1;
      totals[b] += 1;
    }
    return { rows: students.map((s) => ({ student: s, counts: counts.get(s.id) ?? emptyCounts() })), totals };
  }, [students, tasks, category, now]);

  /* Scoped by student, category and search; status counts come from here. */
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (!byId.has(t.student_id)) return false;
      if (studentFilter !== 'all' && t.student_id !== studentFilter) return false;
      if (category !== 'all' && t.category !== category) return false;
      if (q) {
        const hay = `${t.title} ${t.category} ${nameOf(byId.get(t.student_id))}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, byId, studentFilter, category, query]);

  const statusCounts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: scoped.length, open: 0, overdue: 0, done: 0 };
    for (const t of scoped) {
      if (t.completed) c.done += 1;
      else c.open += 1;
      if (bucketOf(t, now) === 'overdue') c.overdue += 1;
    }
    return c;
  }, [scoped, now]);

  const visible = useMemo(() => {
    const list = scoped.filter((t) => (bucket ? bucketOf(t, now) === bucket : matchesStatus(t, status, now)));
    return list.sort(compareTasks);
  }, [scoped, bucket, status, now]);

  const sections: Section[] = useMemo(() => {
    if (mode === 'date') {
      return BUCKETS.map((b) => ({ key: b.id, bucket: b.id, tasks: visible.filter((t) => bucketOf(t, now) === b.id) })).filter(
        (s) => s.tasks.length > 0,
      );
    }
    const groups = new Map<string, Task[]>();
    for (const t of visible) {
      const list = groups.get(t.student_id) ?? [];
      list.push(t);
      groups.set(t.student_id, list);
    }
    return students.filter((s) => groups.has(s.id)).map((s) => ({ key: s.id, student: s, tasks: groups.get(s.id) ?? [] }));
  }, [mode, visible, students, now]);

  const filtersActive = status !== 'all' || bucket !== null || studentFilter !== 'all' || category !== 'all' || query.trim() !== '';

  function clearFilters() {
    setStatus('all');
    setBucket(null);
    setStudentFilter('all');
    setCategory('all');
    setQuery('');
  }

  function pickFromBoard(studentId: string, b: BucketId | null) {
    setStudentFilter(studentId);
    setBucket(b);
    setStatus('all');
    setQuery('');
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    listRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  const assign = useCallback(
    async (ids: string[], input: AssignInput): Promise<AssignResult[]> => {
      const settled = await Promise.allSettled(ids.map((id) => addTask({ student_id: id, ...input })));
      return settled.map((r, i) => ({ studentId: ids[i], error: r.status === 'rejected' ? errorMessage(r.reason) : null }));
    },
    [addTask],
  );

  // Stable close handlers: Dialog refocuses its first control whenever onClose changes.
  const closeEdit = useCallback(() => setEditingId(null), []);
  const closeDelete = useCallback(() => setDeletingId(null), []);
  const closeAssign = useCallback(() => setAssignOpen(false), []);

  async function onToggle(task: Task) {
    if (inFlight.current.has(task.id)) return;
    inFlight.current.add(task.id);
    setPendingIds((p) => new Set(p).add(task.id));
    setRowErrors((e) => {
      if (!(task.id in e)) return e;
      const next = { ...e };
      delete next[task.id];
      return next;
    });
    try {
      await toggleTask(task);
    } catch (err) {
      setRowErrors((e) => ({ ...e, [task.id]: errorMessage(err) }));
    } finally {
      inFlight.current.delete(task.id);
      setPendingIds((p) => {
        const next = new Set(p);
        next.delete(task.id);
        return next;
      });
    }
  }

  const editing = editingId ? tasks.find((t) => t.id === editingId) : undefined;
  const deleting = deletingId ? tasks.find((t) => t.id === deletingId) : undefined;
  // Block the panel only until the first data arrives; a roster change refetches tasks
  // in the background without unmounting an open assign form or the board.
  const loading = studentsLoading || (tasksLoading && tasks.length === 0);
  const openTotal = statusCounts.open;

  const header = (
    <PanelHeader
      index="04"
      eyebrow="Work"
      title="Task Manager"
      description="Assign tasks to one student or a whole group, see who is falling behind, and keep every list moving."
      actions={
        students.length > 0 && !assignOpen ? (
          <Button variant="primary" onClick={() => setAssignOpen(true)}>
            <IconPlus size={14} />
            Assign task
          </Button>
        ) : undefined
      }
    />
  );

  if (loading) {
    return (
      <Panel wide>
        {header}
        <LoadingBlock label="Loading tasks" />
      </Panel>
    );
  }

  if (studentsError) {
    return (
      <Panel wide>
        {header}
        <div role="alert" className="flex flex-wrap items-center gap-4 border-y border-portal-red/40 py-5 text-sm text-portal-red">
          <span>Could not load your students. {studentsError}</span>
          <Button size="sm" variant="outline" onClick={reloadStudents}>
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
        <EmptyState title="No students yet" body="Once students are added to your roster, you can assign and track their tasks here." />
      </Panel>
    );
  }

  const editingName = editing ? nameOf(byId.get(editing.student_id)) : '';
  const deletingName = deleting ? nameOf(byId.get(deleting.student_id)) : '';

  return (
    <Panel wide>
      {header}

      {assignOpen && (
        <AssignForm
          students={students}
          initialSelected={studentFilter !== 'all' ? [studentFilter] : []}
          onAssign={assign}
          onClose={closeAssign}
        />
      )}

      {tasksError && (
        <div role="alert" className="mb-10 flex flex-wrap items-center gap-4 border-y border-portal-red/40 py-4 text-sm text-portal-red">
          <span>Could not load tasks. {tasksError}</span>
          <Button size="sm" variant="outline" onClick={reloadTasks}>
            Try again
          </Button>
        </div>
      )}

      {!tasksError && (
        <StatusBoard rows={board.rows} totals={board.totals} studentFilter={studentFilter} bucket={bucket} onPick={pickFromBoard} />
      )}

      {/* List */}
      <section ref={listRef} aria-label="Task list" className="scroll-mt-6">
        <SectionLabel
          action={
            <div role="group" aria-label="Group tasks" className="flex border border-portal-line-strong">
              {(['student', 'date'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={cx(
                    microLabel,
                    'h-8 px-3 transition-colors',
                    mode === m ? 'bg-portal-select text-portal-text' : 'text-portal-muted hover:text-portal-text',
                  )}
                >
                  {m === 'student' ? 'By student' : 'By due date'}
                </button>
              ))}
            </div>
          }
        >
          Tasks <span className="ml-2 text-portal-dim">{pad2(openTotal)} open</span>
        </SectionLabel>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4">
          <div role="group" aria-label="Filter by status" className="flex flex-wrap border-b border-portal-line">
            {STATUS_FILTERS.map((f) => {
              const active = bucket === null && status === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setStatus(f.id);
                    setBucket(null);
                  }}
                  className={cx(
                    'relative -mb-px flex h-10 items-center gap-2 border-b-2 px-3 text-sm transition-colors',
                    active ? 'text-portal-text' : 'border-transparent text-portal-muted hover:text-portal-text',
                  )}
                  style={active ? { borderColor: toneColor[f.tone] } : undefined}
                >
                  {f.label}
                  <span
                    className="font-mono text-[11px] tabular-nums"
                    style={{ color: f.id === 'overdue' && statusCounts.overdue > 0 ? toneColor.red : 'var(--color-portal-dim)' }}
                  >
                    {pad2(statusCounts[f.id])}
                  </span>
                </button>
              );
            })}
            {bucket && (
              <span className="ml-auto flex items-center gap-2 self-center pl-3">
                <span className={cx(microLabel, 'text-portal-muted')}>Board</span>
                <Tag tone={BUCKET_META[bucket].tone}>{BUCKET_META[bucket].label}</Tag>
                <IconButton aria-label="Clear the board filter" onClick={() => setBucket(null)}>
                  <IconClose size={13} />
                </IconButton>
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_11rem]">
            <div className="relative">
              <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-portal-dim" />
              <Input
                aria-label="Search tasks"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks or students"
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <Select aria-label="Filter by student" value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
              <option value="all">All students</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {nameOf(s)}
                </option>
              ))}
            </Select>
            <Select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {tasksError ? null : tasks.length === 0 ? (
          <EmptyState
            title="No tasks yet"
            body="Assign the first task to one student, or to several at once."
            action={
              !assignOpen && (
                <Button variant="primary" onClick={() => setAssignOpen(true)}>
                  <IconPlus size={14} />
                  Assign task
                </Button>
              )
            }
          />
        ) : sections.length === 0 ? (
          <EmptyState
            title="Nothing matches these filters"
            body="Try another status, student or search."
            action={
              filtersActive && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="flex flex-col gap-10">
            {sections.map((section) => (
              <TaskSection
                key={`${mode}:${section.key}`}
                section={section}
                now={now}
                mode={mode}
                byId={byId}
                pendingIds={pendingIds}
                rowErrors={rowErrors}
                onOpenStudent={(id) => onOpenStudent(id, 'tasks')}
                onToggle={onToggle}
                onEdit={(t) => setEditingId(t.id)}
                onDelete={(t) => setDeletingId(t.id)}
              />
            ))}
          </div>
        )}
      </section>

      {editing && (
        <EditTaskDialog
          key={editing.id}
          task={editing}
          studentName={editingName}
          onClose={closeEdit}
          onSave={(updates) => updateTask(editing.id, updates)}
        />
      )}
      {deleting && (
        <DeleteTaskDialog
          key={deleting.id}
          task={deleting}
          studentName={deletingName}
          onClose={closeDelete}
          onDelete={() => deleteTask(deleting.id)}
        />
      )}
    </Panel>
  );
}

function TaskSection({
  section,
  now,
  mode,
  byId,
  pendingIds,
  rowErrors,
  onOpenStudent,
  onToggle,
  onEdit,
  onDelete,
}: {
  section: Section;
  now: Date;
  mode: GroupMode;
  byId: Map<string, Profile>;
  pendingIds: Set<string>;
  rowErrors: Record<string, string>;
  onOpenStudent: (id: string) => void;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const open = section.tasks.filter((t) => !t.completed).length;
  const overdue = section.tasks.filter((t) => bucketOf(t, now) === 'overdue').length;
  const done = section.tasks.length - open;
  const meta = section.bucket ? BUCKET_META[section.bucket] : null;
  const student = section.student;

  return (
    <section aria-label={section.student ? nameOf(section.student) : meta?.label}>
      <header className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b border-portal-line-strong pb-2">
        {section.student ? (
          <>
            <Avatar initials={initialsOf(section.student)} size={28} tone={overdue > 0 ? 'red' : 'accent'} />
            <h3 className="min-w-0 truncate font-serif text-lg font-bold text-portal-text">{nameOf(section.student)}</h3>
          </>
        ) : (
          meta && (
            <>
              <Diamond size={8} color={toneColor[meta.tone]} />
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: meta.tone === 'neutral' ? 'var(--color-portal-body)' : toneColor[meta.tone] }}>
                {meta.label}
              </h3>
            </>
          )
        )}
        <span className={cx(microLabel, 'flex items-center gap-3 text-portal-dim')}>
          {mode === 'student' ? (
            <>
              <span>{pad2(open)} open</span>
              {overdue > 0 && <span className="text-portal-red">{pad2(overdue)} overdue</span>}
              {done > 0 && <span>{pad2(done)} done</span>}
            </>
          ) : (
            <span>{pad2(section.tasks.length)}</span>
          )}
        </span>
        <span className="h-px min-w-4 flex-1" />
        {student && (
          <Button size="sm" variant="ghost" className="-mr-3" onClick={() => onOpenStudent(student.id)}>
            Open portal
            <IconArrowRight size={14} />
          </Button>
        )}
      </header>
      <ul className="stagger">
        {section.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            now={now}
            studentName={mode === 'date' ? nameOf(byId.get(task.student_id)) : undefined}
            pending={pendingIds.has(task.id)}
            error={rowErrors[task.id] ?? null}
            onToggle={() => onToggle(task)}
            onEdit={() => onEdit(task)}
            onDelete={() => onDelete(task)}
          />
        ))}
      </ul>
    </section>
  );
}
