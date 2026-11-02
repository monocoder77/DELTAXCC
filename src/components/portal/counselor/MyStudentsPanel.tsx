'use client';

/* ==========================================================================
   02 Students (counselor)
   The roster as a ruled table: progress, next deadline, tasks and a status
   for every student. Sort, search and narrow to "only my students".
   Adding a student creates their account and shows the credentials once.
   All counselors see all students; "Primary" marks assigned_consultant_id.
   ========================================================================== */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { EssayStatus, Profile } from '@/types/database';
import { errorMessage, useAccountActions, useApplications, useMe, useNow, useStudents, useTasks } from '@/lib/hooks';
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
  SegmentBar,
  Select,
  Tag,
  cx,
  daysUntil,
  formatDate,
  pad2,
  relativeDays,
  toneColor,
} from '../ui/primitives';
import type { Tone } from '../ui/primitives';
import { IconCheck, IconChevronRight, IconEye, IconSearch, IconSparkle, IconUserPlus } from '../ui/icons';

/** Copy glyph (two offset squares). The shared icon set has no copy icon. */
function CopyGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      <path d="M9 9h11v11H9z" />
      <path d="M5 15H4V4h11v1" />
    </svg>
  );
}

const DONE: ReadonlySet<EssayStatus> = new Set<EssayStatus>(['final', 'submitted']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

type SortKey = 'name' | 'progress' | 'deadline';

interface RosterRow {
  student: Profile;
  primary: boolean;
  schools: number;
  essaysDone: number;
  essaysTotal: number;
  inReview: number;
  nextDeadline: string | null;
  nextDays: number | null;
  openTasks: number;
  overdueTasks: number;
  status: { label: string; tone: Tone };
}

function statusFor(overdue: number, inReview: number): { label: string; tone: Tone } {
  if (overdue > 0) return { label: 'Overdue', tone: 'red' };
  if (inReview > 0) return { label: 'Needs review', tone: 'amber' };
  return { label: 'On track', tone: 'green' };
}

function progressOf(row: RosterRow): number {
  return row.essaysTotal > 0 ? row.essaysDone / row.essaysTotal : -1;
}

/* --------------------------------------------------------------------------
   Password helpers (crypto.getRandomValues, unbiased)
   -------------------------------------------------------------------------- */
const PASSWORD_SETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*-_=+?'];

function randomInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

/** 16 characters with at least one upper, lower, digit and symbol; no look-alikes. */
function generatePassword(length = 16): string {
  const all = PASSWORD_SETS.join('');
  const chars = PASSWORD_SETS.map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Copying is not available in this browser. Select the text and copy it by hand.');
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    throw new Error('Could not copy. Select the text and copy it by hand.');
  }
}

/** Copy state that resets itself after a moment. */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = async (id: string, text: string) => {
    try {
      await copyText(text);
      setError(null);
      setCopied(id);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 1800);
    } catch (err) {
      setCopied(null);
      setError(errorMessage(err));
    }
  };
  return { copied, error, copy };
}

/* --------------------------------------------------------------------------
   Panel
   -------------------------------------------------------------------------- */
const GRID =
  'lg:grid lg:grid-cols-[minmax(0,2.4fr)_56px_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_112px_16px] lg:items-center lg:gap-5';

export default function MyStudentsPanel({ onOpenStudent }: CounselorPanelProps) {
  const me = useMe();
  const now = useNow();
  const { students, loading: studentsLoading, error: studentsError, reload: reloadStudents } = useStudents();
  const studentIds = useMemo(() => students.map((s) => s.id), [students]);
  const app = useApplications(studentIds);
  const taskApi = useTasks(studentIds);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [onlyMine, setOnlyMine] = useState(false);
  const [adding, setAdding] = useState(false);
  const searchId = useId();
  const sortId = useId();

  const rows = useMemo<RosterRow[]>(() => {
    return students.map((student) => {
      const schools = app.schoolsWithEssays.filter((s) => s.student_id === student.id);
      let essaysDone = 0;
      let essaysTotal = 0;
      let inReview = 0;
      let nextDeadline: string | null = null;
      let nextDays: number | null = null;
      schools.forEach((school) => {
        school.prompts.forEach((p) => {
          essaysTotal += 1;
          if (p.essay && DONE.has(p.essay.status)) essaysDone += 1;
          if (p.essay?.status === 'in_review') inReview += 1;
        });
        if (school.is_common_app) return;
        const d = daysUntil(school.deadline, now);
        if (d !== null && d >= 0 && (nextDays === null || d < nextDays)) {
          nextDays = d;
          nextDeadline = school.deadline;
        }
      });
      const tasks = taskApi.tasks.filter((t) => t.student_id === student.id && !t.completed);
      const overdueTasks = tasks.filter((t) => {
        const d = daysUntil(t.due_date, now);
        return d !== null && d < 0;
      }).length;
      return {
        student,
        primary: Boolean(me && student.assigned_consultant_id === me.id),
        schools: schools.filter((s) => !s.is_common_app).length,
        essaysDone,
        essaysTotal,
        inReview,
        nextDeadline,
        nextDays,
        openTasks: tasks.length,
        overdueTasks,
        status: statusFor(overdueTasks, inReview),
      };
    });
  }, [students, app.schoolsWithEssays, taskApi.tasks, me, now]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (onlyMine && !r.primary) return false;
      if (!q) return true;
      return r.student.full_name.toLowerCase().includes(q) || r.student.email.toLowerCase().includes(q);
    });
    const byName = (a: RosterRow, b: RosterRow) => a.student.full_name.localeCompare(b.student.full_name);
    return list.sort((a, b) => {
      if (sort === 'progress') return progressOf(b) - progressOf(a) || byName(a, b);
      if (sort === 'deadline') {
        if (a.nextDays === null && b.nextDays === null) return byName(a, b);
        if (a.nextDays === null) return 1;
        if (b.nextDays === null) return -1;
        return a.nextDays - b.nextDays || byName(a, b);
      }
      return byName(a, b);
    });
  }, [rows, query, onlyMine, sort]);

  const mineCount = rows.filter((r) => r.primary).length;

  const header = (
    <PanelHeader
      index="02"
      eyebrow="Students"
      title="Students"
      description="Every student in the practice. Primary marks the students assigned to you."
      actions={
        <Button variant="primary" onClick={() => setAdding(true)}>
          <IconUserPlus size={16} />
          Add student
        </Button>
      }
    />
  );

  // Stable so the Dialog's focus effect (which depends on onClose) does not re-run every render.
  const closeAdd = useCallback(() => setAdding(false), []);

  // The dialog is rendered outside every loading/error/empty branch so it keeps its state
  // (the one-time credentials) while the roster refreshes after a student is created.
  const dialog = adding ? <AddStudentDialog onClose={closeAdd} onOpenStudent={onOpenStudent} /> : null;
  const shell = (body: ReactNode) => (
    <>
      <Panel wide>
        {header}
        {body}
      </Panel>
      {dialog}
    </>
  );

  const hasStudents = studentIds.length > 0;
  if (!me || studentsLoading || (hasStudents && (app.loading || taskApi.loading))) {
    return shell(<LoadingBlock label="Loading students" />);
  }

  const fatal = studentsError ?? app.error ?? taskApi.error;
  if (fatal) {
    return shell(
      <div role="alert" className="flex flex-col gap-4 border-l-2 border-portal-red py-2 pl-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-portal-text">We could not load your students.</p>
          <p className="mt-1 text-xs text-portal-muted">{fatal}</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            reloadStudents();
            app.reload();
            taskApi.reload();
          }}
        >
          Try again
        </Button>
      </div>,
    );
  }

  if (!hasStudents) {
    return shell(
      <EmptyState
        title="No students yet"
        body="Create an account for your first student. You will get a temporary password to share with them."
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <IconUserPlus size={16} />
            Add student
          </Button>
        }
      />,
    );
  }

  return shell(
    <>
      {/* Controls */}
      <div className="animate-rise mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="w-full sm:w-72">
            <label htmlFor={searchId} className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">
              Search
            </label>
            <div className="relative">
              <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-portal-dim" />
              <Input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or email"
                style={{ paddingLeft: '2.25rem' }}
              />
            </div>
          </div>
          <div className="w-full sm:w-48">
            <label htmlFor={sortId} className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">
              Sort by
            </label>
            <Select id={sortId} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="name">Name</option>
              <option value="progress">Essay progress</option>
              <option value="deadline">Next deadline</option>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between gap-6 md:justify-end">
          <label className="flex min-h-8 cursor-pointer items-center gap-2.5 text-sm text-portal-body">
            <Checkbox checked={onlyMine} onChange={setOnlyMine} label="Only my students" />
            Only my students
          </label>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim">
            {pad2(visible.length)} of {pad2(rows.length)}
            {mineCount > 0 && <span className="text-portal-muted">, {mineCount} yours</span>}
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No students match"
          body={onlyMine && mineCount === 0 ? 'No students are assigned to you yet.' : 'Try a different name or email.'}
          action={
            <Button
              size="sm"
              onClick={() => {
                setQuery('');
                setOnlyMine(false);
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div>
          <div
            className={cx(
              GRID,
              'hidden border-y border-portal-line-strong py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim lg:grid',
            )}
          >
            <span>Student</span>
            <span className="text-right">Schools</span>
            <span>Essays final</span>
            <span>Next deadline</span>
            <span>Tasks</span>
            <span>Status</span>
            <span />
          </div>
          <ul className="stagger border-t border-portal-line-strong lg:border-t-0">
            {visible.map((row) => (
              <RosterRowView key={row.student.id} row={row} onOpen={() => onOpenStudent(row.student.id)} />
            ))}
          </ul>
        </div>
      )}
    </>,
  );
}

/* --------------------------------------------------------------------------
   Roster row: a grid on wide screens, stacked on small ones
   -------------------------------------------------------------------------- */
function MicroLabel({ children }: { children: string }) {
  return <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim lg:hidden">{children}</span>;
}

function RosterRowView({ row, onOpen }: { row: RosterRow; onOpen: () => void }) {
  const { student, status } = row;
  const deadlineTone: Tone | null = row.nextDays === null ? null : row.nextDays <= 3 ? 'red' : row.nextDays <= 7 ? 'amber' : null;
  return (
    <li className="border-b border-portal-line">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${student.full_name || 'student'}${row.primary ? ', primary' : ''}. ${status.label}. ${
          row.essaysTotal ? `${row.essaysDone} of ${row.essaysTotal} essays final` : 'No essays yet'
        }. Next deadline ${row.nextDeadline ? relativeDays(row.nextDeadline).toLowerCase() : 'none upcoming'}. ${row.openTasks} open tasks${
          row.overdueTasks ? `, ${row.overdueTasks} overdue` : ''
        }.`}
        className={cx(GRID, 'group relative block w-full py-4 text-left transition-colors hover:bg-portal-hover lg:px-2')}
      >
        {/* Hover marker */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[2px] origin-top scale-y-0 bg-portal-accent transition-transform duration-300 ease-portal group-hover:scale-y-100 group-focus-visible:scale-y-100"
        />

        {/* Student */}
        <span className="flex min-w-0 items-center gap-3">
          <Avatar initials={student.avatar_initials} size={36} tone={row.primary ? 'accent' : 'neutral'} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium text-portal-text">{student.full_name || 'Unnamed student'}</span>
              {row.primary && <Tag tone="accent">Primary</Tag>}
            </span>
            <span className="block truncate text-xs text-portal-muted">{student.email}</span>
          </span>
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] lg:hidden" style={{ color: toneColor[status.tone] }}>
            <Diamond size={7} color={toneColor[status.tone]} />
            {status.label}
          </span>
        </span>

        {/* Stats: 2x2 on small screens, columns on wide */}
        <span className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:contents">
          <span className="block lg:text-right">
            <MicroLabel>Schools</MicroLabel>
            <span className="font-mono text-sm tabular-nums text-portal-text">{row.schools}</span>
          </span>

          <span className="block min-w-0">
            <MicroLabel>Essays final</MicroLabel>
            <span className="mb-1.5 block font-mono text-xs tabular-nums text-portal-body">
              {row.essaysTotal ? `${row.essaysDone}/${row.essaysTotal}` : 'No essays yet'}
            </span>
            <SegmentBar
              value={row.essaysDone}
              max={row.essaysTotal}
              segments={10}
              tone={row.essaysTotal > 0 && row.essaysDone >= row.essaysTotal ? 'green' : 'accent'}
              label={`${row.essaysDone} of ${row.essaysTotal} essays final`}
            />
          </span>

          <span className="block min-w-0">
            <MicroLabel>Next deadline</MicroLabel>
            {row.nextDeadline ? (
              <>
                <span className="block font-mono text-xs" style={{ color: deadlineTone ? toneColor[deadlineTone] : 'var(--color-portal-text)' }}>
                  {relativeDays(row.nextDeadline)}
                </span>
                <span className="block text-xs text-portal-dim">{formatDate(row.nextDeadline, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </>
            ) : (
              <span className="block text-xs text-portal-dim">None upcoming</span>
            )}
          </span>

          <span className="block">
            <MicroLabel>Tasks</MicroLabel>
            <span className="block font-mono text-xs tabular-nums text-portal-body">{row.openTasks} open</span>
            {row.overdueTasks > 0 && <span className="block font-mono text-xs tabular-nums text-portal-red">{row.overdueTasks} overdue</span>}
          </span>
        </span>

        {/* Status (wide only; small screens show it beside the name) */}
        <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] lg:inline-flex" style={{ color: toneColor[status.tone] }}>
          <Diamond size={7} color={toneColor[status.tone]} />
          {status.label}
        </span>

        <IconChevronRight
          size={14}
          className="hidden text-portal-dim transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-portal-text lg:block"
        />
      </button>
    </li>
  );
}

/* --------------------------------------------------------------------------
   Add student
   -------------------------------------------------------------------------- */
interface Created {
  userId: string;
  fullName: string;
  email: string;
  password: string;
}

function AddStudentDialog({ onClose, onOpenStudent }: { onClose: () => void; onOpenStudent: (id: string) => void }) {
  const { createStudent } = useAccountActions();
  const formId = useId();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const { copied, error: copyError, copy } = useCopy();

  // Stable close that ignores requests while the account is being created.
  // Refs keep it current without changing identity (the Dialog re-focuses when onClose changes).
  const pendingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    pendingRef.current = pending;
    onCloseRef.current = onClose;
  });
  const close = useCallback(() => {
    if (!pendingRef.current) onCloseRef.current();
  }, []);

  const onGenerate = () => {
    setPassword(generatePassword());
    setShowPassword(true);
    setErrors((e) => ({ ...e, password: undefined }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const name = fullName.trim();
    const mail = email.trim();
    const next: typeof errors = {};
    if (!name) next.name = 'Enter the student\'s full name.';
    if (!EMAIL_PATTERN.test(mail)) next.email = 'Enter a valid email address.';
    if (password.length < MIN_PASSWORD) next.password = `Use at least ${MIN_PASSWORD} characters.`;
    setErrors(next);
    if (next.name || next.email || next.password) return;

    setPending(true);
    setSubmitError(null);
    try {
      const result = await createStudent({ fullName: name, email: mail, password });
      setCreated({ userId: result.userId, fullName: name, email: mail, password });
      setPassword('');
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  if (created) {
    const both = `Email: ${created.email}\nTemporary password: ${created.password}`;
    return (
      <Dialog
        open
        onClose={close}
        title="Student account created"
        footer={
          <>
            <Button
              onClick={() => {
                onClose();
                onOpenStudent(created.userId);
              }}
            >
              Open student
            </Button>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-portal-body">
          {created.fullName} can sign in now. Share these details securely, in person or through a password manager, not in a group chat.
          This password will not be shown again.
        </p>
        <dl className="mt-5 border-y border-portal-line">
          <div className="flex items-center justify-between gap-4 border-b border-portal-line py-3">
            <div className="min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">Email</dt>
              <dd className="mt-1 truncate font-mono text-sm text-portal-text">{created.email}</dd>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">Temporary password</dt>
              <dd className="mt-1 break-all font-mono text-sm text-portal-text">{created.password}</dd>
            </div>
            <IconButton aria-label="Copy password" onClick={() => void copy('password', created.password)}>
              {copied === 'password' ? <IconCheck size={15} className="text-portal-green" /> : <CopyGlyph size={15} />}
            </IconButton>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => void copy('both', both)}>
            {copied === 'both' ? <IconCheck size={14} className="text-portal-green" /> : null}
            {copied === 'both' ? 'Copied' : 'Copy email and password'}
          </Button>
          <span className="text-xs text-portal-dim">Ask them to change it in Settings after their first sign in.</span>
        </div>
        {copyError && (
          <p role="alert" className="mt-3 text-xs text-portal-red">
            {copyError}
          </p>
        )}
        <span className="sr-only" aria-live="polite">
          {copied ? 'Copied to clipboard' : ''}
        </span>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={close}
      title="Add a student"
      footer={
        <>
          <Button onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="primary" disabled={pending}>
            {pending ? 'Creating account' : 'Create account'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Field label="Full name" htmlFor={nameId} error={errors.name}>
          <Input
            id={nameId}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="off"
            disabled={pending}
            aria-invalid={Boolean(errors.name)}
          />
        </Field>
        <Field label="Email" htmlFor={emailId} error={errors.email}>
          <Input
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            disabled={pending}
            aria-invalid={Boolean(errors.email)}
          />
        </Field>
        <Field
          label="Temporary password"
          htmlFor={passwordId}
          error={errors.password}
          hint={`At least ${MIN_PASSWORD} characters. Generate one for a strong random password.`}
          counter={password ? `${password.length}` : undefined}
        >
          <div className="flex items-stretch gap-2">
            <div className="relative min-w-0 flex-1">
              <Input
                id={passwordId}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                spellCheck={false}
                disabled={pending}
                aria-invalid={Boolean(errors.password)}
                className="font-mono"
                style={{ paddingRight: '4.75rem' }}
              />
              <div className="absolute inset-y-0 right-1 flex items-center">
                <IconButton
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                  className={showPassword ? 'text-portal-accent-light' : undefined}
                >
                  <IconEye size={15} />
                </IconButton>
                <IconButton aria-label="Copy password" onClick={() => void copy('field', password)} disabled={!password}>
                  {copied === 'field' ? <IconCheck size={15} className="text-portal-green" /> : <CopyGlyph size={15} />}
                </IconButton>
              </div>
            </div>
            <Button onClick={onGenerate} disabled={pending} className="flex-none">
              <IconSparkle size={14} />
              Generate
            </Button>
          </div>
        </Field>
        {copyError && (
          <p role="alert" className="-mt-2 text-xs text-portal-red">
            {copyError}
          </p>
        )}
        {submitError && (
          <p role="alert" className="border-l-2 border-portal-red pl-3 text-sm text-portal-red">
            {submitError}
          </p>
        )}
        <p className="text-xs leading-relaxed text-portal-dim">
          The student is assigned to you and can sign in right away. You will see the password once more after the account is created.
        </p>
      </form>
    </Dialog>
  );
}
