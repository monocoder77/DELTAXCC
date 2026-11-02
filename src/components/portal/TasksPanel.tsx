'use client';

/* ==========================================================================
   Tasks: a "next 14 days" strip of square day cells, then ruled groups
   (Overdue, Today, This week, Later, No date, Completed). Students add
   personal to-dos; counselors assign tasks to the student they are viewing.
   ========================================================================== */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { TASK_CATEGORIES, errorMessage, useMe, useNow, useTasks } from '@/lib/hooks';
import type { Task } from '@/types/database';
import type { StudentPanelProps } from './nav';
import {
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
  SegmentBar,
  Select,
  Tag,
  cx,
  daysUntil,
  formatDate,
  pad2,
  parseDate,
  relativeDays,
  toneColor,
} from './ui/primitives';
import type { Tone } from './ui/primitives';
import { IconChevronDown, IconClose, IconEdit, IconPlus, IconSearch, IconTrash } from './ui/icons';

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

type StatusFilter = 'all' | 'open' | 'done' | 'overdue';
type GroupId = 'overdue' | 'today' | 'week' | 'later' | 'none' | 'done';

const STATUS_FILTERS: { id: StatusFilter; label: string; tone: Tone }[] = [
  { id: 'all', label: 'All', tone: 'accent' },
  { id: 'open', label: 'Open', tone: 'accent' },
  { id: 'done', label: 'Done', tone: 'green' },
  { id: 'overdue', label: 'Overdue', tone: 'red' },
];

const GROUPS: { id: GroupId; label: string; tone: Tone }[] = [
  { id: 'overdue', label: 'Overdue', tone: 'red' },
  { id: 'today', label: 'Today', tone: 'accent' },
  { id: 'week', label: 'This week', tone: 'blue' },
  { id: 'later', label: 'Later', tone: 'neutral' },
  { id: 'none', label: 'No date', tone: 'neutral' },
  { id: 'done', label: 'Completed', tone: 'green' },
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

const STRIP_DAYS = 14;
const MAX_MARKERS = 4;

/** The DB types due_date as string, but the column is nullable. */
function dueOf(task: Task): string | null {
  return task.due_date || null;
}

/** Local YYYY-MM-DD for a Date (never via toISOString, which is UTC). */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Normalised key for a task's due date, or null. */
function dueKey(task: Task): string | null {
  const d = parseDate(dueOf(task));
  return d ? dateKey(d) : null;
}

function isOverdue(task: Task, now: Date): boolean {
  if (task.completed) return false;
  const n = daysUntil(dueOf(task), now);
  return n !== null && n < 0;
}

function groupOf(task: Task, now: Date): GroupId {
  if (task.completed) return 'done';
  const n = daysUntil(dueOf(task), now);
  if (n === null) return 'none';
  if (n < 0) return 'overdue';
  if (n === 0) return 'today';
  if (n <= 7) return 'week';
  return 'later';
}

function compareTasks(a: Task, b: Task): number {
  const ka = dueKey(a);
  const kb = dueKey(b);
  if (ka && kb && ka !== kb) return ka < kb ? -1 : 1;
  if (ka && !kb) return -1;
  if (!ka && kb) return 1;
  return a.title.localeCompare(b.title);
}

function toneFor(category: string): Tone {
  return CATEGORY_TONE[category] ?? 'neutral';
}

/* --------------------------------------------------------------------------
   Next 14 days strip (signature)
   -------------------------------------------------------------------------- */

function DayStrip({
  tasks,
  now,
  selected,
  onSelect,
  overdueCount,
  onShowOverdue,
}: {
  tasks: Task[];
  now: Date;
  selected: string | null;
  onSelect: (key: string | null) => void;
  overdueCount: number;
  onShowOverdue: () => void;
}) {
  const days = useMemo(() => {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Array.from({ length: STRIP_DAYS }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const key = dateKey(d);
      const due = tasks.filter((t) => dueKey(t) === key);
      return { key, date: d, offset: i, due };
    });
  }, [tasks, now]);

  return (
    <section aria-label="Next 14 days" className="animate-rise mb-10">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Diamond size={7} />
        <h2 className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.18em] text-portal-muted">Next 14 days</h2>
        <span className="h-px min-w-6 flex-1 bg-portal-line" />
        {overdueCount > 0 && (
          <button
            type="button"
            onClick={onShowOverdue}
            className="inline-flex h-8 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-red hover:text-portal-text"
          >
            <span className="flex gap-[3px]" aria-hidden="true">
              {Array.from({ length: Math.min(overdueCount, MAX_MARKERS) }, (_, i) => (
                <span key={i} className="h-1.5 w-1.5 bg-portal-red" />
              ))}
            </span>
            {overdueCount} overdue
          </button>
        )}
      </div>

      <div className="grid grid-cols-7 border-y border-portal-line-strong md:grid-cols-14 [&>*:nth-child(n+8)]:border-t md:[&>*:nth-child(n+8)]:border-t-0 [&>*:not(:nth-child(7n+1))]:border-l md:[&>*:nth-child(8)]:border-l">
        {days.map((day) => {
          const isToday = day.offset === 0;
          const isSelected = selected === day.key;
          const weekend = day.date.getDay() === 0 || day.date.getDay() === 6;
          const open = day.due.filter((t) => !t.completed);
          const done = day.due.length - open.length;
          const markers = [...open.map(() => 'open' as const), ...Array.from({ length: done }, () => 'done' as const)];
          const shown = markers.slice(0, MAX_MARKERS);
          const extra = markers.length - shown.length;
          const label = `${day.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}: ${
            day.due.length === 0 ? 'nothing due' : `${open.length} open, ${done} done`
          }`;
          return (
            <button
              key={day.key}
              type="button"
              aria-pressed={isSelected}
              aria-label={label}
              title={label}
              onClick={() => onSelect(isSelected ? null : day.key)}
              className={cx(
                'group relative flex aspect-square min-h-[52px] flex-col justify-between border-portal-line p-1.5 text-left transition-colors duration-150 sm:p-2',
                isSelected ? 'bg-portal-select' : 'hover:bg-portal-hover',
                isToday && 'shadow-[inset_0_0_0_1px_var(--color-portal-accent)]',
              )}
            >
              {isSelected && <span className="absolute inset-x-0 top-0 h-[2px] bg-portal-accent-light" aria-hidden="true" />}
              <span className="flex items-baseline justify-between gap-1 font-mono leading-none">
                <span
                  className={cx(
                    'text-[10px] uppercase tracking-[0.12em]',
                    isToday ? 'text-portal-accent-light' : weekend ? 'text-portal-dim' : 'text-portal-muted',
                  )}
                >
                  {day.date.toLocaleDateString('en-US', { weekday: 'narrow' })}
                </span>
                <span
                  className={cx(
                    'text-sm tabular-nums sm:text-base',
                    isToday || isSelected ? 'text-portal-text' : day.due.length ? 'text-portal-body' : 'text-portal-dim',
                  )}
                >
                  {pad2(day.date.getDate())}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-[3px]" aria-hidden="true">
                {shown.map((kind, i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 transition-transform duration-200 group-hover:scale-125"
                    style={
                      kind === 'open'
                        ? { background: toneColor.accent }
                        : { border: `1px solid ${toneColor.green}` }
                    }
                  />
                ))}
                {extra > 0 && <span className="font-mono text-[9px] leading-none text-portal-muted">+{extra}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Quick add
   -------------------------------------------------------------------------- */

function QuickAdd({
  viewer,
  onAdd,
}: {
  viewer: StudentPanelProps['viewer'];
  onAdd: (input: { title: string; category: string; due_date: string | null }) => Promise<unknown>;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>('General');
  const [due, setDue] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!title.trim()) {
      setError('Give the task a title.');
      titleRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onAdd({ title, category, due_date: due || null });
      setTitle('');
      setDue('');
      titleRef.current?.focus();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-10 border-b border-portal-line pb-6" aria-label="Add a task">
      <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">
        <IconPlus size={12} className="text-portal-accent-light" />
        {viewer === 'counselor' ? 'Assign a task to this student' : 'Add a personal task'}
      </p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_10.5rem_auto] sm:items-end">
        <Field label="Task" htmlFor="task-add-title">
          <Input
            id="task-add-title"
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={viewer === 'counselor' ? 'Request a recommendation from your English teacher' : 'Draft my activities list'}
            maxLength={200}
            disabled={pending}
            autoComplete="off"
          />
        </Field>
        <Field label="Category" htmlFor="task-add-category">
          <Select id="task-add-category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={pending}>
            {TASK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due" htmlFor="task-add-due">
          <Input id="task-add-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} disabled={pending} />
        </Field>
        <Button type="submit" variant="primary" disabled={pending} className="w-full sm:w-auto">
          <IconPlus size={14} />
          {pending ? 'Adding' : 'Add'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-portal-red">
          {error}
        </p>
      )}
    </form>
  );
}

/* --------------------------------------------------------------------------
   Edit and delete dialogs
   -------------------------------------------------------------------------- */

function EditTaskDialog({
  task,
  onClose,
  onSave,
}: {
  task: Task;
  onClose: () => void;
  onSave: (updates: { title: string; category: string; due_date: string | null }) => Promise<unknown>;
}) {
  const [title, setTitle] = useState(task.title);
  const [category, setCategory] = useState(task.category || 'General');
  const [due, setDue] = useState(dueKey(task) ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories: string[] = (TASK_CATEGORIES as readonly string[]).includes(category)
    ? [...TASK_CATEGORIES]
    : [...TASK_CATEGORIES, category];

  async function save(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!title.trim()) {
      setError('Give the task a title.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSave({ title: title.trim(), category, due_date: due || null });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit task"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="task-edit-form" variant="primary" disabled={pending}>
            {pending ? 'Saving' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="task-edit-form" onSubmit={save} className="grid gap-5" noValidate>
        <Field label="Task" htmlFor="task-edit-title">
          <Input id="task-edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} disabled={pending} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" htmlFor="task-edit-category">
            <Select id="task-edit-category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={pending}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date" htmlFor="task-edit-due" hint={due ? relativeDays(due) : 'No due date'}>
            <div className="flex gap-2">
              <Input id="task-edit-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} disabled={pending} />
              <Button variant="ghost" size="md" onClick={() => setDue('')} disabled={pending || !due}>
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

function DeleteTaskDialog({ task, onClose, onDelete }: { task: Task; onClose: () => void; onDelete: () => Promise<unknown> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Delete this task?"
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Keep it
          </Button>
          <Button variant="danger" onClick={confirm} disabled={pending}>
            <IconTrash size={14} />
            {pending ? 'Deleting' : 'Delete task'}
          </Button>
        </>
      }
    >
      <p className="font-serif text-base text-portal-text">{task.title}</p>
      <p className="mt-2 text-sm text-portal-muted">This removes it from the list for both the student and the counselor. It cannot be undone.</p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-portal-red">
          {error}
        </p>
      )}
    </Dialog>
  );
}

/* --------------------------------------------------------------------------
   Rows and groups
   -------------------------------------------------------------------------- */

function TaskRow({
  task,
  now,
  canEdit,
  pending,
  error,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  now: Date;
  canEdit: boolean;
  pending: boolean;
  error: string | null;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overdue = isOverdue(task, now);
  const due = dueOf(task);
  const n = daysUntil(due, now);
  const dueText = due ? `${formatDate(due)}${task.completed ? '' : `, ${relativeDays(due).toLowerCase()}`}` : 'No date';

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
          <span
            className={cx(
              'min-w-0 flex-1 break-words text-[15px] leading-snug transition-colors',
              task.completed ? 'text-portal-dim line-through decoration-portal-dim' : 'text-portal-text',
            )}
          >
            {task.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Tag tone={task.completed ? 'neutral' : toneFor(task.category)}>{task.category || 'General'}</Tag>
            <span
              className={cx(
                'whitespace-nowrap font-mono text-[11px] tabular-nums sm:w-36 sm:text-right',
                overdue ? 'text-portal-red' : task.completed || n === null ? 'text-portal-dim' : n === 0 ? 'text-portal-accent-light' : 'text-portal-muted',
              )}
            >
              {dueText}
            </span>
          </span>
        </div>
        <div className="flex w-16 flex-none justify-end">
          {canEdit && (
            <>
              <IconButton aria-label={`Edit "${task.title}"`} onClick={onEdit}>
                <IconEdit size={15} />
              </IconButton>
              <IconButton aria-label={`Delete "${task.title}"`} tone="danger" onClick={onDelete}>
                <IconTrash size={15} />
              </IconButton>
            </>
          )}
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

function GroupHeader({
  label,
  tone,
  count,
  collapsible,
  open,
  onToggle,
}: {
  label: string;
  tone: Tone;
  count: number;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const inner = (
    <>
      <Diamond size={7} color={toneColor[tone]} />
      <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: tone === 'neutral' ? undefined : toneColor[tone] }}>
        {label}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-portal-dim">{pad2(count)}</span>
      <span className="h-px flex-1 bg-portal-line-strong" />
      {collapsible && (
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">
          {open ? 'Hide' : 'Show'}
          <IconChevronDown size={14} className={cx('transition-transform duration-200', open && 'rotate-180')} />
        </span>
      )}
    </>
  );
  if (collapsible) {
    return (
      <h3 className="mb-1">
        <button type="button" aria-expanded={open} onClick={onToggle} className="flex h-9 w-full items-center gap-3 text-left text-portal-muted hover:text-portal-text">
          {inner}
        </button>
      </h3>
    );
  }
  return <h3 className="mb-1 flex h-9 items-center gap-3 text-portal-muted">{inner}</h3>;
}

/* --------------------------------------------------------------------------
   Panel
   -------------------------------------------------------------------------- */

export default function TasksPanel({ studentId, viewer }: StudentPanelProps) {
  // Keyed so filters, dialogs and drafts reset when a counselor switches students.
  return <TasksView key={studentId} studentId={studentId} viewer={viewer} />;
}

function TasksView({ studentId, viewer }: Pick<StudentPanelProps, 'studentId' | 'viewer'>) {
  const ids = useMemo(() => [studentId], [studentId]);
  const { tasks, loading, error, reload, addTask, updateTask, toggleTask, deleteTask } = useTasks(ids);
  const me = useMe();
  const now = useNow();

  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());
  const inFlight = useRef<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const closeEdit = useCallback(() => setEditing(null), []);
  const closeDelete = useCallback(() => setDeleting(null), []);

  const studentTasks = useMemo(() => tasks.filter((t) => t.student_id === studentId), [tasks, studentId]);

  const canEdit = (task: Task) => viewer === 'counselor' || (!!me && task.created_by === me.id);

  const doneCount = studentTasks.filter((t) => t.completed).length;
  const overdueCount = studentTasks.filter((t) => isOverdue(t, now)).length;

  const categories = useMemo(() => {
    const extra = studentTasks.map((t) => t.category).filter((c) => c && !(TASK_CATEGORIES as readonly string[]).includes(c));
    return [...TASK_CATEGORIES, ...[...new Set(extra)].sort()];
  }, [studentTasks]);

  // Scope = everything except the status filter, so status counts match what clicking shows.
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return studentTasks.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (day && dueKey(t) !== day) return false;
      if (q && !t.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [studentTasks, category, day, query]);

  const counts: Record<StatusFilter, number> = {
    all: scoped.length,
    open: scoped.filter((t) => !t.completed).length,
    done: scoped.filter((t) => t.completed).length,
    overdue: scoped.filter((t) => isOverdue(t, now)).length,
  };

  const visible = scoped.filter((t) => {
    if (status === 'open') return !t.completed;
    if (status === 'done') return t.completed;
    if (status === 'overdue') return isOverdue(t, now);
    return true;
  });

  const grouped = new Map<GroupId, Task[]>();
  for (const t of [...visible].sort(compareTasks)) {
    const g = groupOf(t, now);
    grouped.set(g, [...(grouped.get(g) ?? []), t]);
  }
  const completedSorted = (grouped.get('done') ?? []).sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
  if (completedSorted.length) grouped.set('done', completedSorted);

  const filtersActive = status !== 'all' || category !== 'all' || !!query.trim() || !!day;
  const completedOpen = showCompleted || status === 'done' || !!day;

  function clearFilters() {
    setStatus('all');
    setCategory('all');
    setQuery('');
    setDay(null);
  }

  function setRowError(id: string, message: string | null) {
    setRowErrors((prev) => {
      const next = { ...prev };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }

  async function handleToggle(task: Task) {
    if (inFlight.current.has(task.id)) return;
    inFlight.current.add(task.id);
    setPendingIds((s) => new Set(s).add(task.id));
    setRowError(task.id, null);
    try {
      await toggleTask(task);
    } catch (err) {
      setRowError(task.id, errorMessage(err));
    } finally {
      inFlight.current.delete(task.id);
      setPendingIds((s) => {
        const next = new Set(s);
        next.delete(task.id);
        return next;
      });
    }
  }

  const header = (
    <PanelHeader
      index="03"
      eyebrow="Tasks"
      title={viewer === 'counselor' ? 'Tasks' : 'Your tasks'}
      description={
        viewer === 'counselor'
          ? 'Assign and track this student’s to-dos. They see everything here on their own list.'
          : 'Everything on your list, from essays to recommendation letters. Add your own to-dos next to the ones your counselor assigns.'
      }
      actions={
        studentTasks.length > 0 ? (
          <div className="w-full min-w-[220px] md:w-64">
            <div className="mb-2 flex items-baseline justify-between font-mono">
              <span className="text-[10px] uppercase tracking-[0.16em] text-portal-muted">Completed</span>
              <span className="text-sm tabular-nums text-portal-text">
                {pad2(doneCount)}
                <span className="text-portal-dim"> / {pad2(studentTasks.length)}</span>
              </span>
            </div>
            <SegmentBar value={doneCount} max={studentTasks.length} segments={24} tone="green" label="Tasks completed" />
          </div>
        ) : undefined
      }
    />
  );

  if (loading && studentTasks.length === 0) {
    return (
      <Panel>
        {header}
        <LoadingBlock label="Loading tasks" />
      </Panel>
    );
  }

  return (
    <Panel>
      {header}

      {error && (
        <div role="alert" className="mb-8 flex flex-wrap items-center justify-between gap-3 border-y border-portal-red/40 py-3 text-sm text-portal-red">
          <span>Tasks could not be loaded. {error}</span>
          <Button size="sm" variant="danger" onClick={reload}>
            Try again
          </Button>
        </div>
      )}

      <QuickAdd viewer={viewer} onAdd={(input) => addTask({ ...input, student_id: studentId })} />

      {studentTasks.length === 0 ? (
        !error && (
          <EmptyState
            title="Nothing on the list yet"
            body={
              viewer === 'counselor'
                ? 'Tasks you assign show up here and on the student’s dashboard.'
                : 'Add a to-do above, or wait for your counselor to assign the next steps.'
            }
          />
        )
      ) : (
        <>
          <DayStrip
            tasks={studentTasks}
            now={now}
            selected={day}
            onSelect={(key) => {
              setDay(key);
              if (key && status === 'overdue') setStatus('all');
            }}
            overdueCount={overdueCount}
            onShowOverdue={() => {
              setDay(null);
              setStatus('overdue');
            }}
          />

          {/* Filters */}
          <div className="mb-8 flex flex-col gap-4 border-b border-portal-line pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-x-1 gap-y-2">
              {STATUS_FILTERS.map((f) => {
                const active = status === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatus(f.id)}
                    className={cx(
                      'relative inline-flex h-8 items-center gap-2 px-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors',
                      active ? 'text-portal-text' : 'text-portal-muted hover:text-portal-text',
                    )}
                  >
                    {f.label}
                    <span className="tabular-nums" style={{ color: counts[f.id] > 0 && f.id !== 'all' ? toneColor[f.tone] : 'var(--color-portal-dim)' }}>
                      {pad2(counts[f.id])}
                    </span>
                    {active && <span className="absolute inset-x-3 bottom-0 h-[2px]" style={{ background: toneColor[f.tone] }} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="task-filter-category" className="sr-only">
                Filter by category
              </label>
              <div className="sm:w-48">
                <Select id="task-filter-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="relative sm:w-60">
                <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-portal-dim" />
                <label htmlFor="task-search" className="sr-only">
                  Search tasks
                </label>
                <Input
                  id="task-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tasks"
                  style={{ paddingLeft: '2.25rem' }}
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          {day && (
            <p className="mb-6 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-portal-muted">
              <span className="h-1.5 w-1.5 bg-portal-accent-light" aria-hidden="true" />
              Due {formatDate(day, { weekday: 'long', month: 'long', day: 'numeric' })}
              <button type="button" onClick={() => setDay(null)} className="inline-flex h-8 items-center gap-1 text-portal-accent-light hover:text-portal-text">
                <IconClose size={12} />
                Clear day
              </button>
            </p>
          )}

          {visible.length === 0 ? (
            <div className="flex flex-col items-start gap-3 border-y border-dashed border-portal-line-strong py-8">
              <p className="font-serif text-lg text-portal-text">No tasks match these filters.</p>
              {filtersActive && (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="stagger space-y-8">
              {GROUPS.map((g) => {
                const list = grouped.get(g.id);
                if (!list || list.length === 0) return null;
                const isDone = g.id === 'done';
                const open = !isDone || completedOpen;
                return (
                  <section key={g.id} aria-label={g.label}>
                    <GroupHeader
                      label={g.label}
                      tone={g.tone}
                      count={list.length}
                      collapsible={isDone && status !== 'done' && !day}
                      open={open}
                      onToggle={() => setShowCompleted((v) => !v)}
                    />
                    {open && (
                      <ul className="border-t border-portal-line">
                        {list.map((t) => (
                          <TaskRow
                            key={t.id}
                            task={t}
                            now={now}
                            canEdit={canEdit(t)}
                            pending={pendingIds.has(t.id)}
                            error={rowErrors[t.id] ?? null}
                            onToggle={() => handleToggle(t)}
                            onEdit={() => setEditing(t)}
                            onDelete={() => setDeleting(t)}
                          />
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {editing && (
        <EditTaskDialog
          key={editing.id}
          task={editing}
          onClose={closeEdit}
          onSave={(updates) => updateTask(editing.id, updates)}
        />
      )}
      {deleting && (
        <DeleteTaskDialog
          key={deleting.id}
          task={deleting}
          onClose={closeDelete}
          onDelete={async () => {
            await deleteTask(deleting.id);
            setRowError(deleting.id, null);
          }}
        />
      )}
    </Panel>
  );
}
