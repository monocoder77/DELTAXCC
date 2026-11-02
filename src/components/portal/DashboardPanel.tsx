'use client';

/* ==========================================================================
   Student dashboard: mission control for one student's applications.
   Signature moments: a big mono countdown to the next deadline and an
   application matrix of status diamonds (one row per school, one glyph
   per prompt). Everything else is ruled lists, no cards.
   ========================================================================== */

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { errorMessage, useApplications, useMe, useMessaging, useNow, useProfile, useTasks } from '@/lib/hooks';
import type { SchoolWithEssays } from '@/lib/hooks';
import type { EssayComment, EssayStatus, Message, Profile, PromptWithEssay, Task } from '@/types/database';
import type { StudentPanelProps, Viewer } from './nav';
import {
  Avatar,
  Button,
  CategoryTag,
  Checkbox,
  ESSAY_STATUS,
  ESSAY_STATUS_ORDER,
  EmptyState,
  LoadingBlock,
  Panel,
  PanelHeader,
  SectionLabel,
  SegmentBar,
  Spinner,
  Stat,
  StatRow,
  StatusGlyph,
  Tag,
  cx,
  daysUntil,
  formatDate,
  pad2,
  relativeDays,
  timeAgo,
  toneColor,
} from './ui/primitives';
import type { Tone } from './ui/primitives';
import { IconArrowRight } from './ui/icons';

type Navigate = StudentPanelProps['onNavigate'];

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */
/** Status of a prompt's essay; anything missing or unrecognised counts as not started. */
function promptStatus(p: PromptWithEssay): EssayStatus {
  const status = p.essay?.status;
  return status && status in ESSAY_STATUS ? status : 'not_started';
}

function isComplete(status: EssayStatus): boolean {
  return status === 'final' || status === 'submitted';
}

function firstName(name: string | null | undefined): string {
  const n = name?.trim();
  return n ? n.split(/\s+/)[0] : '';
}

function initialsOf(profile: Profile | null | undefined, fallbackName: string): string {
  if (profile?.avatar_initials) return profile.avatar_initials;
  const parts = (profile?.full_name ?? fallbackName).trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Red under a week, amber under two weeks. */
function urgencyTone(days: number): Tone {
  if (days < 7) return 'red';
  if (days < 14) return 'amber';
  return 'neutral';
}

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function isOverdue(task: Task, now: Date): boolean {
  if (task.completed) return false;
  const d = daysUntil(task.due_date, now);
  return d !== null && d < 0;
}

/** Ascending by due date (so overdue comes first), undated last, then title. */
function compareTasks(a: Task, b: Task): number {
  const da = a.due_date || '';
  const db = b.due_date || '';
  if (da && db && da !== db) return da < db ? -1 : 1;
  if (Boolean(da) !== Boolean(db)) return da ? -1 : 1;
  return a.title.localeCompare(b.title);
}

function timeOf(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

const microLabel = 'font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted';

/* --------------------------------------------------------------------------
   Panel
   -------------------------------------------------------------------------- */
export default function DashboardPanel({ studentId, viewer, onNavigate }: StudentPanelProps) {
  const ids = useMemo(() => [studentId], [studentId]);
  const apps = useApplications(ids);
  const tasksApi = useTasks(ids);
  const messaging = useMessaging(viewer === 'student' ? null : ids);
  const now = useNow();
  const me = useMe();
  const { profile: viewedProfile } = useProfile(viewer === 'counselor' ? studentId : null);
  const student = viewer === 'student' ? me : viewedProfile;
  const name = firstName(student?.full_name);

  const schools = apps.schoolsWithEssays;

  /* Deadlines: non Common App schools due today or later. */
  const upcoming = useMemo(() => {
    return schools
      .filter((s) => !s.is_common_app)
      .map((s) => ({ school: s, days: daysUntil(s.deadline, now) }))
      .filter((x): x is { school: SchoolWithEssays; days: number } => x.days !== null && x.days >= 0)
      .sort((a, b) => a.days - b.days || a.school.name.localeCompare(b.school.name));
  }, [schools, now]);

  /* Essay counts, one per prompt so nothing double counts or goes negative. */
  const essayStats = useMemo(() => {
    const byStatus = Object.fromEntries(ESSAY_STATUS_ORDER.map((s) => [s, 0])) as Record<EssayStatus, number>;
    let total = 0;
    for (const s of schools) {
      for (const p of s.prompts) {
        total += 1;
        byStatus[promptStatus(p)] += 1;
      }
    }
    const complete = byStatus.final + byStatus.submitted;
    return { total, complete, inReview: byStatus.in_review, byStatus };
  }, [schools]);

  const openTasks = tasksApi.tasks.filter((t) => !t.completed);
  const overdueCount = openTasks.filter((t) => isOverdue(t, now)).length;

  const loading = apps.loading || tasksApi.loading;

  const title =
    viewer === 'counselor'
      ? name
        ? `${name}'s dashboard`
        : 'Student dashboard'
      : name
        ? `${greeting(now)}, ${name}.`
        : `${greeting(now)}.`;

  const summary = (() => {
    const parts: string[] = [];
    const next = upcoming[0];
    if (next) parts.push(`${next.school.name} is due ${relativeDays(next.school.deadline).toLowerCase()}.`);
    if (overdueCount > 0) parts.push(`${overdueCount} ${plural(overdueCount, 'task is', 'tasks are')} overdue.`);
    if (parts.length === 0) {
      return viewer === 'counselor' ? 'Applications, tasks and feedback at a glance.' : 'Here is where your applications stand.';
    }
    return parts.join(' ');
  })();

  if (loading) {
    return (
      <Panel>
        <PanelHeader index="01" eyebrow="Dashboard" title={title} />
        <LoadingBlock label="Loading dashboard" />
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader index="01" eyebrow={viewer === 'counselor' ? 'Student view' : 'Mission control'} title={title} description={summary} />

      {apps.error && (
        <ErrorLine message={`Could not load schools and essays. ${apps.error}`} onRetry={apps.reload} className="mb-10" />
      )}

      {schools.length === 0 && !apps.error ? (
        <div className="animate-rise mb-14">
          <EmptyState
            title={viewer === 'counselor' ? `No schools on ${name ? `${name}'s` : 'this'} list yet` : "Let's build your list"}
            body={
              viewer === 'counselor'
                ? 'Add schools and their prompts in Schools & Essays. Deadlines, progress and essays will show up here.'
                : 'Add the schools you are applying to in Schools & Essays. Your deadlines, essay prompts and progress will show up here.'
            }
            action={
              <Button variant="primary" onClick={() => onNavigate('schools')}>
                Go to Schools & Essays
                <IconArrowRight size={14} />
              </Button>
            }
          />
        </div>
      ) : schools.length > 0 ? (
        <>
          <Countdown upcoming={upcoming} onNavigate={onNavigate} />

          <StatRow className="animate-rise mb-14">
            <Stat
              value={
                <>
                  {essayStats.complete}
                  <span className="text-portal-dim">/{essayStats.total}</span>
                </>
              }
              label="Essays complete"
              tone={essayStats.total > 0 && essayStats.complete === essayStats.total ? 'green' : 'neutral'}
              sub={essayStats.total === 0 ? 'No prompts yet' : 'Final or submitted'}
            />
            <Stat value={essayStats.inReview} label="In review" tone={essayStats.inReview > 0 ? 'amber' : 'neutral'} />
            <Stat value={openTasks.length} label="Open tasks" />
            <Stat value={overdueCount} label="Overdue" tone={overdueCount > 0 ? 'red' : 'neutral'} sub={overdueCount > 0 ? 'Needs attention' : 'All on track'} />
          </StatRow>

          <Matrix schools={schools} stats={essayStats} now={now} onNavigate={onNavigate} />
        </>
      ) : null}

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-0">
        <div className="min-w-0 lg:pr-10">
          <UpNext api={tasksApi} now={now} onNavigate={onNavigate} />
        </div>
        <div className="min-w-0 space-y-12 lg:border-l lg:border-portal-line lg:pl-10">
          <LatestMessage
            messaging={messaging}
            meId={me?.id ?? null}
            studentId={studentId}
            studentName={student?.full_name ?? ''}
            viewer={viewer}
            now={now}
            onNavigate={onNavigate}
          />
          <RecentFeedback schools={schools} studentId={studentId} meId={me?.id ?? null} viewer={viewer} now={now} onNavigate={onNavigate} />
        </div>
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
   Shared bits
   -------------------------------------------------------------------------- */
function ErrorLine({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cx('flex flex-wrap items-center gap-3 border-l-2 border-portal-red py-1 pl-4 text-sm text-portal-red', className)}>
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <Button size="sm" variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

function LinkAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-portal-accent-light transition-colors hover:text-portal-text"
    >
      {children}
      <IconArrowRight size={12} />
    </button>
  );
}

/** Small corner brackets that frame the countdown. */
function Brackets({ color }: { color: string }) {
  const base = 'pointer-events-none absolute h-3 w-3';
  const style = { borderColor: color };
  return (
    <>
      <span aria-hidden="true" className={cx(base, 'left-0 top-0 border-l border-t')} style={style} />
      <span aria-hidden="true" className={cx(base, 'right-0 top-0 border-r border-t')} style={style} />
      <span aria-hidden="true" className={cx(base, 'bottom-0 left-0 border-b border-l')} style={style} />
      <span aria-hidden="true" className={cx(base, 'bottom-0 right-0 border-b border-r')} style={style} />
    </>
  );
}

/* --------------------------------------------------------------------------
   Countdown (signature)
   -------------------------------------------------------------------------- */
const RUNWAY = 14;

function Countdown({ upcoming, onNavigate }: { upcoming: { school: SchoolWithEssays; days: number }[]; onNavigate: Navigate }) {
  if (upcoming.length === 0) {
    return (
      <section className="animate-rise mb-12" aria-label="Next deadline">
        <SectionLabel>Next deadline</SectionLabel>
        <p className="border-l border-portal-line py-2 pl-4 text-sm text-portal-muted">
          No upcoming deadlines. Add a deadline to a school in Schools & Essays to start the countdown.
        </p>
      </section>
    );
  }

  const days = upcoming[0].days;
  const sameDay = upcoming.filter((u) => u.days === days);
  const lead = sameDay[0].school;
  const later = upcoming.filter((u) => u.days !== days).slice(0, 3);
  const tone = urgencyTone(days);
  const color = tone === 'neutral' ? 'var(--color-portal-text)' : toneColor[tone];
  const done = lead.prompts.filter((p) => isComplete(promptStatus(p))).length;
  const lit = Math.min(days, RUNWAY);

  return (
    <section className="animate-rise mb-12" aria-label="Next deadline">
      <SectionLabel>Next deadline</SectionLabel>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-0">
        <div className="min-w-0 lg:pr-10">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-6">
            <div className="relative px-5 py-4" aria-label={days === 0 ? 'Due today' : `${days} ${plural(days, 'day', 'days')} left`} role="img">
              <Brackets color={`color-mix(in srgb, ${color} 55%, transparent)`} />
              <div className="flex items-end gap-3">
                <span className="font-mono text-[88px] font-bold leading-[0.82] tracking-tight tabular-nums sm:text-[128px]" style={{ color }}>
                  {pad2(days)}
                </span>
                <span className={cx(microLabel, 'pb-2')} style={{ color }}>
                  {days === 0 ? 'Due today' : plural(days, 'day', 'days')}
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1 pb-4">
              <button
                type="button"
                onClick={() => onNavigate('schools', { schoolId: lead.id })}
                className="group block max-w-full text-left"
              >
                <span className="block text-balance font-serif text-2xl font-bold leading-tight text-portal-text transition-colors group-hover:text-portal-accent-light sm:text-3xl">
                  {lead.name}
                </span>
              </button>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {lead.decision_plan && <Tag tone="accent">{lead.decision_plan}</Tag>}
                <CategoryTag category={lead.category} />
                <span className="font-mono text-xs text-portal-body">
                  {formatDate(lead.deadline, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-portal-muted">
                {lead.prompts.length === 0 ? (
                  'No essay prompts on file.'
                ) : (
                  <>
                    <span className="inline-flex gap-1.5">
                      {lead.prompts.map((p) => (
                        <StatusGlyph key={p.id} status={promptStatus(p)} size={8} />
                      ))}
                    </span>
                    {done} of {lead.prompts.length} {plural(lead.prompts.length, 'essay', 'essays')} complete
                  </>
                )}
              </p>
              {sameDay.length > 1 && (
                <p className="mt-2 text-xs text-portal-dim">
                  Also due the same day: {sameDay.slice(1).map((u) => u.school.name).join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Two week runway: one cell per day, lit cells are days still left. */}
          <div className="mt-6" aria-hidden="true">
            <div className="flex gap-[3px]">
              {Array.from({ length: RUNWAY }, (_, i) => (
                <span
                  key={i}
                  className="h-1.5 flex-1 transition-colors duration-500"
                  style={{
                    background: i < lit ? color : 'rgba(255,255,255,0.07)',
                    opacity: i < lit ? 0.35 + (0.65 * (i + 1)) / RUNWAY : 1,
                    transitionDelay: `${i * 24}ms`,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim">
              <span>Today</span>
              <span>Two weeks</span>
            </div>
          </div>
        </div>

        <div className="min-w-0 border-t border-portal-line pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <p className={cx(microLabel, 'mb-3')}>After that</p>
          {later.length === 0 ? (
            <p className="text-sm text-portal-dim">Nothing else on the calendar yet.</p>
          ) : (
            <ul className="stagger divide-y divide-portal-line border-y border-portal-line">
              {later.map(({ school, days: d }) => {
                const t = urgencyTone(d);
                return (
                  <li key={school.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate('schools', { schoolId: school.id })}
                      className="group grid min-h-12 w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-left transition-colors hover:bg-portal-hover"
                    >
                      <span className="font-mono text-xs uppercase text-portal-muted">{formatDate(school.deadline)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-portal-text group-hover:text-portal-accent-light">{school.name}</span>
                        {school.decision_plan && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-portal-dim">{school.decision_plan}</span>}
                      </span>
                      <span className="font-mono text-xs tabular-nums" style={{ color: t === 'neutral' ? 'var(--color-portal-muted)' : toneColor[t] }}>
                        {d}d
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Application matrix (signature)
   -------------------------------------------------------------------------- */
function Matrix({
  schools,
  stats,
  now,
  onNavigate,
}: {
  schools: SchoolWithEssays[];
  stats: { total: number; complete: number; byStatus: Record<EssayStatus, number> };
  now: Date;
  onNavigate: Navigate;
}) {
  const pct = stats.total > 0 ? Math.round((stats.complete / stats.total) * 100) : 0;
  return (
    <section className="mb-14" aria-label="Application matrix">
      <SectionLabel action={<LinkAction onClick={() => onNavigate('schools')}>Schools & Essays</LinkAction>}>Application matrix</SectionLabel>

      <div className={cx('hidden border-b border-portal-line-strong pb-2 pl-3 md:grid', MATRIX_COLS)}>
        <span className={microLabel}>School</span>
        <span className={microLabel}>Type</span>
        <span className={microLabel}>Deadline</span>
        <span className={microLabel}>Essays</span>
      </div>
      <ul className="stagger border-b border-portal-line max-md:border-t">
        {schools.map((s) => (
          <MatrixRow key={s.id} school={s} now={now} onNavigate={onNavigate} />
        ))}
      </ul>

      <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-8">
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className={microLabel}>Overall progress</span>
            <span className="font-mono text-xs tabular-nums text-portal-body">
              {pct}% <span className="text-portal-dim">complete</span>
            </span>
          </div>
          <SegmentBar value={stats.complete} max={stats.total} segments={24} tone="green" label="Essays complete" />
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Essays by status">
          {ESSAY_STATUS_ORDER.map((status) => (
            <li key={status} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-portal-muted">
              <StatusGlyph status={status} size={8} />
              {ESSAY_STATUS[status].label}
              <span className="tabular-nums text-portal-text">{stats.byStatus[status]}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const MATRIX_COLS = 'md:grid-cols-[minmax(0,1.6fr)_96px_112px_minmax(0,1.2fr)] md:gap-4';

function MatrixRow({ school, now, onNavigate }: { school: SchoolWithEssays; now: Date; onNavigate: Navigate }) {
  const d = daysUntil(school.deadline, now);
  const dueTone: Tone | null = d === null || d < 0 ? null : d < 7 ? 'red' : d < 14 ? 'amber' : null;
  return (
    <li className="group relative border-t border-portal-line first:border-t-0 transition-colors hover:bg-portal-hover">
      {/* Whole-row target sits underneath; glyph buttons sit above it. */}
      <button
        type="button"
        onClick={() => onNavigate('schools', { schoolId: school.id })}
        className="absolute inset-0 z-0 w-full"
        aria-label={`Open ${school.name}`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-px origin-top scale-y-0 bg-portal-accent transition-transform duration-300 ease-portal group-hover:scale-y-100"
      />
      <div className={cx('pointer-events-none relative z-[1] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 pl-3', MATRIX_COLS)}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-portal-text group-hover:text-portal-accent-light">{school.name}</p>
          {school.program && <p className="truncate text-xs text-portal-dim">{school.program}</p>}
        </div>
        <div>{school.is_common_app ? <Tag tone="accent">Common App</Tag> : <CategoryTag category={school.category} />}</div>
        <div className="font-mono text-xs max-md:col-start-1">
          <span className="text-portal-body">{formatDate(school.deadline)}</span>
          {d !== null && (
            <span className="ml-2 md:ml-0 md:block" style={{ color: dueTone ? toneColor[dueTone] : 'var(--color-portal-dim)' }}>
              {d < 0 ? 'Passed' : relativeDays(school.deadline)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center max-md:col-span-2 max-md:-ml-2">
          {school.prompts.length === 0 ? (
            <span className="px-2 text-xs text-portal-dim">No prompts yet</span>
          ) : (
            school.prompts.map((p) => {
              const status = promptStatus(p);
              const label = `${p.title}: ${ESSAY_STATUS[status].label}`;
              return (
                <button
                  key={p.id}
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => onNavigate('schools', { schoolId: school.id, promptId: p.id })}
                  className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center border border-transparent transition-colors hover:border-portal-line-strong"
                >
                  <StatusGlyph status={status} size={11} />
                </button>
              );
            })
          )}
        </div>
      </div>
    </li>
  );
}

/* --------------------------------------------------------------------------
   Up next: open tasks
   -------------------------------------------------------------------------- */
function UpNext({ api, now, onNavigate }: { api: ReturnType<typeof useTasks>; now: Date; onNavigate: Navigate }) {
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  // Tasks checked off here stay visible (struck through) so they can be undone.
  const [checkedHere, setCheckedHere] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const list = api.tasks
    .filter((t) => !t.completed || checkedHere.has(t.id))
    .sort(compareTasks)
    .slice(0, 5);
  const openCount = api.tasks.filter((t) => !t.completed).length;
  const hiddenOpen = openCount - list.filter((t) => !t.completed).length;

  async function toggle(task: Task) {
    if (pending.has(task.id)) return;
    setError(null);
    setPending((s) => new Set(s).add(task.id));
    if (!task.completed) setCheckedHere((s) => new Set(s).add(task.id));
    try {
      await api.toggleTask(task);
    } catch (err) {
      setError(`Could not update "${task.title}". ${errorMessage(err)}`);
    } finally {
      setPending((s) => {
        const next = new Set(s);
        next.delete(task.id);
        return next;
      });
    }
  }

  return (
    <section aria-label="Up next">
      <SectionLabel action={<LinkAction onClick={() => onNavigate('tasks')}>All tasks</LinkAction>}>Up next</SectionLabel>
      {api.error ? (
        <ErrorLine message={`Could not load tasks. ${api.error}`} onRetry={api.reload} />
      ) : list.length === 0 ? (
        <p className="border-l border-portal-line py-2 pl-4 text-sm text-portal-muted">
          {api.tasks.length === 0 ? 'No tasks yet.' : 'Nothing open. Every task is checked off.'}
        </p>
      ) : (
        <>
          <ul className="stagger border-y border-portal-line">
            {list.map((task) => {
              const d = task.completed ? null : daysUntil(task.due_date, now);
              const overdue = d !== null && d < 0;
              const soon = d !== null && d >= 0 && d <= 2;
              const busy = pending.has(task.id);
              return (
                <li key={task.id} className={cx('flex min-h-12 items-center gap-3 border-t border-portal-line py-2.5 first:border-t-0', busy && 'opacity-60')}>
                  <fieldset disabled={busy} className="m-0 flex min-w-0 flex-none border-0 p-0">
                    {/* The label widens the hit area of the 16px checkbox to 32px. */}
                    <label className="-ml-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center">
                      <Checkbox
                        checked={task.completed}
                        onChange={() => void toggle(task)}
                        label={task.completed ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                      />
                    </label>
                  </fieldset>
                  {overdue && <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rotate-45 bg-portal-red" />}
                  <div className="min-w-0 flex-1">
                    <p className={cx('truncate text-sm', task.completed ? 'text-portal-dim line-through' : 'text-portal-text')}>{task.title}</p>
                    {task.category && <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-portal-dim">{task.category}</p>}
                  </div>
                  <span
                    className="flex-none whitespace-nowrap font-mono text-[11px]"
                    style={{
                      color: task.completed
                        ? 'var(--color-portal-green)'
                        : overdue
                          ? toneColor.red
                          : soon
                            ? toneColor.amber
                            : 'var(--color-portal-muted)',
                    }}
                  >
                    {task.completed ? 'Done' : overdue ? `Overdue, ${relativeDays(task.due_date).toLowerCase()}` : relativeDays(task.due_date)}
                  </span>
                </li>
              );
            })}
          </ul>
          {hiddenOpen > 0 && (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim">{hiddenOpen} more open</p>
          )}
        </>
      )}
      {error && <ErrorLine message={error} className="mt-3" />}
    </section>
  );
}

/* --------------------------------------------------------------------------
   Latest message
   -------------------------------------------------------------------------- */
function LatestMessage({
  messaging,
  meId,
  studentId,
  studentName,
  viewer,
  now,
  onNavigate,
}: {
  messaging: ReturnType<typeof useMessaging>;
  meId: string | null;
  studentId: string;
  studentName: string;
  viewer: Viewer;
  now: Date;
  onNavigate: Navigate;
}) {
  const latest = useMemo(() => {
    let best: Message | null = null;
    for (const m of messaging.messages) {
      if (!best || timeOf(m.created_at) > timeOf(best.created_at)) best = m;
    }
    return best;
  }, [messaging.messages]);

  if (messaging.loading) {
    return (
      <section aria-label="Latest message">
        <SectionLabel>Latest message</SectionLabel>
        <Spinner label="Loading messages" />
      </section>
    );
  }
  if (messaging.error) {
    return (
      <section aria-label="Latest message">
        <SectionLabel>Latest message</SectionLabel>
        <ErrorLine message={`Could not load messages. ${messaging.error}`} />
      </section>
    );
  }
  if (!latest) return null;

  const sender: Profile | undefined = messaging.peopleById[latest.sender_id] ?? latest.sender;
  const mine = meId !== null && latest.sender_id === meId;
  const fallback = latest.sender_id === studentId ? studentName || 'Student' : viewer === 'student' ? 'Your counselor' : 'Counselor';
  const senderName = mine ? 'You' : sender?.full_name || fallback;
  const text = latest.content.trim() || (latest.file_url ? 'Shared a file.' : '');

  return (
    <section aria-label="Latest message">
      <SectionLabel action={<LinkAction onClick={() => onNavigate('messages')}>Messages</LinkAction>}>Latest message</SectionLabel>
      <button
        type="button"
        onClick={() => onNavigate('messages')}
        className="animate-rise group flex w-full gap-4 border-l border-portal-accent/60 py-1 pl-4 text-left transition-colors hover:border-portal-accent"
      >
        <Avatar initials={initialsOf(sender, senderName)} size={32} tone={mine ? 'neutral' : 'accent'} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium text-portal-text group-hover:text-portal-accent-light">{senderName}</span>
            <span className="flex-none font-mono text-[10px] text-portal-dim">{timeAgo(latest.created_at, now)}</span>
          </span>
          <span className="mt-1 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-portal-body">{text}</span>
        </span>
      </button>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Recent feedback: newest comments not written by the student
   -------------------------------------------------------------------------- */
function RecentFeedback({
  schools,
  studentId,
  meId,
  viewer,
  now,
  onNavigate,
}: {
  schools: SchoolWithEssays[];
  studentId: string;
  meId: string | null;
  viewer: Viewer;
  now: Date;
  onNavigate: Navigate;
}) {
  const items = useMemo(() => {
    const all: { comment: EssayComment; school: SchoolWithEssays; prompt: PromptWithEssay }[] = [];
    for (const school of schools) {
      for (const prompt of school.prompts) {
        for (const comment of prompt.comments ?? []) {
          if (comment.author_id !== studentId) all.push({ comment, school, prompt });
        }
      }
    }
    return all.sort((a, b) => timeOf(b.comment.created_at) - timeOf(a.comment.created_at)).slice(0, 3);
  }, [schools, studentId]);

  if (schools.length === 0) return null;

  return (
    <section aria-label="Recent feedback">
      <SectionLabel>Recent feedback</SectionLabel>
      {items.length === 0 ? (
        <p className="border-l border-portal-line py-2 pl-4 text-sm text-portal-muted">
          No feedback yet. {viewer === 'student' ? 'Notes from your counselor' : 'Essay notes'} will show up here.
        </p>
      ) : (
        <ul className="stagger space-y-1">
          {items.map(({ comment, school, prompt }) => {
            const mine = meId !== null && comment.author_id === meId;
            const author = mine ? 'You' : comment.author?.full_name || (viewer === 'student' ? 'Your counselor' : 'Counselor');
            return (
              <li key={comment.id}>
                <button
                  type="button"
                  onClick={() => onNavigate('schools', { schoolId: school.id, promptId: prompt.id })}
                  className="group block w-full border-l border-portal-line py-2.5 pl-4 text-left transition-colors hover:border-portal-accent"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium text-portal-text group-hover:text-portal-accent-light">{author}</span>
                    <span className="flex-none font-mono text-[10px] text-portal-dim">{timeAgo(comment.created_at, now)}</span>
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.12em] text-portal-muted">
                    {prompt.title} <span className="text-portal-dim">/ {school.name}</span>
                  </span>
                  <span className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-portal-body">{comment.content}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
