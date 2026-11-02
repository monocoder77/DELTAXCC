'use client';

/* ==========================================================================
   01 Dashboard (counselor)
   Greeting, a metric strip, the deadline radar (every school deadline in the
   next 30 days plotted on a ruled timeline), a merged "needs attention" list
   sorted by urgency, and the next upcoming deadlines.
   All counselors see all students; "yours" means assigned_consultant_id.
   ========================================================================== */

import { useMemo, useState } from 'react';
import type { Conversation, EssayStatus, Message, Profile, Task } from '@/types/database';
import { useApplications, useMe, useMessaging, useNow, useStudents, useTasks } from '@/lib/hooks';
import type { SchoolWithEssays } from '@/lib/hooks';
import type { CounselorPanelProps, StudentFocus, StudentTab } from '../nav';
import {
  Avatar,
  Button,
  Diamond,
  EmptyState,
  LoadingBlock,
  Panel,
  PanelHeader,
  SectionLabel,
  Stat,
  StatRow,
  Tag,
  cx,
  daysUntil,
  formatDate,
  pad2,
  relativeDays,
  timeAgo,
  toneColor,
} from '../ui/primitives';
import type { Tone } from '../ui/primitives';
import { IconArrowRight, IconChevronRight } from '../ui/icons';

const RADAR_DAYS = 30;
const SOON_DAYS = 14;
const ATTENTION_LIMIT = 10;
const UPCOMING_LIMIT = 8;
const DAY_MS = 86_400_000;
const DONE: ReadonlySet<EssayStatus> = new Set<EssayStatus>(['final', 'submitted']);

/* --------------------------------------------------------------------------
   Derived data
   -------------------------------------------------------------------------- */
type Target = { kind: 'student'; studentId: string; tab: StudentTab; focus?: StudentFocus } | { kind: 'messages' };

interface Deadline {
  key: string;
  school: SchoolWithEssays;
  student: Profile | null;
  days: number;
  done: number;
  total: number;
}

type AttentionKind = 'review' | 'task' | 'message' | 'deadline';

interface AttentionItem {
  key: string;
  kind: AttentionKind;
  /** Lower is more urgent. Roughly "days of slack left". */
  score: number;
  tone: Tone;
  tag: string;
  student: Profile | null;
  title: string;
  detail: string;
  meta: string;
  target: Target;
}

const KIND_ORDER: Record<AttentionKind, number> = { task: 0, deadline: 1, review: 2, message: 3 };

function timeOf(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function nameOf(student: Profile | null | undefined): string {
  return student?.full_name?.trim() || 'Student';
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function urgencyTone(days: number): Tone {
  if (days <= 3) return 'red';
  if (days <= 7) return 'amber';
  if (days <= SOON_DAYS) return 'accent';
  return 'neutral';
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * For each student, the latest message in their thread if it came from the
 * student (so it is waiting on a counselor). Same thread choice as the
 * Messages panel: this counselor's thread first, otherwise the most active.
 */
function awaitingReplies(
  students: Profile[],
  conversations: Conversation[],
  messages: Message[],
  meId: string | undefined,
): Map<string, Message> {
  const byConv = new Map<string, Message[]>();
  messages.forEach((m) => {
    const list = byConv.get(m.conversation_id);
    if (list) list.push(m);
    else byConv.set(m.conversation_id, [m]);
  });
  const lastOf = (list: Message[]) =>
    list.reduce<Message | null>((acc, m) => (!acc || timeOf(m.created_at) >= timeOf(acc.created_at) ? m : acc), null);

  const result = new Map<string, Message>();
  students.forEach((student) => {
    const ranked = conversations
      .filter((c) => c.student_id === student.id)
      .map((c) => ({ c, last: lastOf(byConv.get(c.id) ?? []) }))
      .sort((a, b) => timeOf(b.last?.created_at) - timeOf(a.last?.created_at));
    const pick = ranked.find((r) => r.c.consultant_id === meId) ?? ranked[0];
    if (pick?.last && pick.last.sender_id === student.id) result.set(student.id, pick.last);
  });
  return result;
}

function isOverdue(task: Task, now: Date): boolean {
  if (task.completed) return false;
  const d = daysUntil(task.due_date, now);
  return d !== null && d < 0;
}

/* --------------------------------------------------------------------------
   Panel
   -------------------------------------------------------------------------- */
export default function CounselorDashboard({ onNavigate, onOpenStudent }: CounselorPanelProps) {
  const me = useMe();
  const now = useNow();
  const { students, loading: studentsLoading, error: studentsError, reload: reloadStudents } = useStudents();
  const studentIds = useMemo(() => students.map((s) => s.id), [students]);
  const app = useApplications(studentIds);
  const taskApi = useTasks(studentIds);
  const msg = useMessaging(studentIds);
  const [showAll, setShowAll] = useState(false);

  const byId = useMemo(() => {
    const map = new Map<string, Profile>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  /** Every non Common App school with a deadline today or later. */
  const deadlines = useMemo<Deadline[]>(() => {
    const list: Deadline[] = [];
    app.schoolsWithEssays.forEach((school) => {
      if (school.is_common_app) return;
      const days = daysUntil(school.deadline, now);
      if (days === null || days < 0) return;
      const total = school.prompts.length;
      const done = school.prompts.filter((p) => p.essay && DONE.has(p.essay.status)).length;
      list.push({ key: school.id, school, student: byId.get(school.student_id) ?? null, days, done, total });
    });
    return list.sort((a, b) => a.days - b.days || nameOf(a.student).localeCompare(nameOf(b.student)) || a.school.name.localeCompare(b.school.name));
  }, [app.schoolsWithEssays, byId, now]);

  const awaiting = useMemo(
    () => awaitingReplies(students, msg.conversations, msg.messages, me?.id),
    [students, msg.conversations, msg.messages, me?.id],
  );

  const { items: attention, reviewCount, overdueCount } = useMemo(() => {
    const items: AttentionItem[] = [];
    let reviews = 0;
    let overdue = 0;

    // Essays waiting on review, oldest first.
    app.schoolsWithEssays.forEach((school) => {
      school.prompts.forEach((prompt) => {
        const essay = prompt.essay;
        if (!essay || essay.status !== 'in_review') return;
        reviews += 1;
        const waited = Math.max(0, Math.floor((now.getTime() - timeOf(essay.updated_at)) / DAY_MS));
        items.push({
          key: `review-${essay.id}`,
          kind: 'review',
          score: Math.max(0, 5 - waited) + timeOf(essay.updated_at) / 1e15,
          tone: 'amber',
          tag: 'Review',
          student: byId.get(essay.student_id) ?? byId.get(school.student_id) ?? null,
          title: prompt.title || 'Untitled prompt',
          detail: school.name,
          meta: essay.updated_at ? `Sent ${timeAgo(essay.updated_at, now)}` : 'Waiting',
          target: { kind: 'student', studentId: school.student_id, tab: 'schools', focus: { schoolId: school.id, promptId: prompt.id } },
        });
      });
    });

    // Overdue tasks, most overdue first.
    taskApi.tasks.forEach((task) => {
      if (!isOverdue(task, now)) return;
      overdue += 1;
      const late = Math.abs(daysUntil(task.due_date, now) ?? 0);
      items.push({
        key: `task-${task.id}`,
        kind: 'task',
        score: -late,
        tone: 'red',
        tag: 'Overdue',
        student: byId.get(task.student_id) ?? null,
        title: task.title,
        detail: task.category || 'Task',
        meta: `${plural(late, 'day')} late`,
        target: { kind: 'student', studentId: task.student_id, tab: 'tasks' },
      });
    });

    // Students waiting on a reply.
    awaiting.forEach((message, studentId) => {
      const waited = Math.max(0, Math.floor((now.getTime() - timeOf(message.created_at)) / DAY_MS));
      items.push({
        key: `message-${message.id}`,
        kind: 'message',
        score: Math.max(0, 3 - waited) + 0.5,
        tone: 'accent',
        tag: 'Reply',
        student: byId.get(studentId) ?? null,
        title: message.content.trim() || 'Sent an attachment',
        detail: 'Waiting on a reply',
        meta: timeAgo(message.created_at, now),
        target: { kind: 'messages' },
      });
    });

    // Deadlines this week with essays still open.
    deadlines.forEach((d) => {
      if (d.days > 7 || d.total === 0 || d.done >= d.total) return;
      items.push({
        key: `deadline-${d.school.id}`,
        kind: 'deadline',
        score: d.days,
        tone: d.days <= 3 ? 'red' : 'amber',
        tag: 'Deadline',
        student: d.student,
        title: d.school.name,
        detail: `${d.done} of ${plural(d.total, 'essay')} final`,
        meta: relativeDays(d.school.deadline),
        target: { kind: 'student', studentId: d.school.student_id, tab: 'schools', focus: { schoolId: d.school.id } },
      });
    });

    items.sort((a, b) => a.score - b.score || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.key.localeCompare(b.key));
    return { items, reviewCount: reviews, overdueCount: overdue };
  }, [app.schoolsWithEssays, taskApi.tasks, awaiting, deadlines, byId, now]);

  const open = (target: Target) => {
    if (target.kind === 'messages') onNavigate('c-messages');
    else onOpenStudent(target.studentId, target.tab, target.focus);
  };
  const openSchool = (d: Deadline) => onOpenStudent(d.school.student_id, 'schools', { schoolId: d.school.id });

  const firstName = me?.full_name?.trim().split(/\s+/)[0] ?? '';
  const header = (
    <PanelHeader
      index="01"
      eyebrow={now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      title={firstName ? `${greetingFor(now)}, ${firstName}.` : `${greetingFor(now)}.`}
      description="Here is where every student stands today: what is due, who is waiting on you, and what is coming up."
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => onNavigate('c-reviews')}>
            Essay reviews
          </Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate('c-students')}>
            All students
            <IconArrowRight size={14} />
          </Button>
        </>
      }
    />
  );

  const hasStudents = studentIds.length > 0;
  const loading = !me || studentsLoading || (hasStudents && (app.loading || taskApi.loading || msg.loading));
  if (loading) {
    return (
      <Panel>
        {header}
        <LoadingBlock label="Loading your dashboard" />
      </Panel>
    );
  }

  const fatal = studentsError ?? app.error ?? taskApi.error;
  if (fatal) {
    return (
      <Panel>
        {header}
        <div role="alert" className="flex flex-col gap-4 border-l-2 border-portal-red py-2 pl-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-portal-text">We could not load your dashboard.</p>
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
        </div>
      </Panel>
    );
  }

  if (!hasStudents) {
    return (
      <Panel>
        {header}
        <EmptyState
          title="No students yet"
          body="Add your first student and their schools, essays and deadlines will show up here."
          action={
            <Button variant="primary" onClick={() => onNavigate('c-students')}>
              Go to students
            </Button>
          }
        />
      </Panel>
    );
  }

  const soonCount = deadlines.filter((d) => d.days <= SOON_DAYS).length;
  const radarItems = deadlines.filter((d) => d.days <= RADAR_DAYS);
  const laterCount = deadlines.length - radarItems.length;
  const yours = me ? students.filter((s) => s.assigned_consultant_id === me.id).length : 0;
  const visibleAttention = showAll ? attention : attention.slice(0, ATTENTION_LIMIT);
  const hiddenCount = attention.length - visibleAttention.length;

  return (
    <Panel>
      {header}

      <StatRow className="animate-rise mb-14">
        <Stat value={pad2(students.length)} label="Students" sub={yours ? `${yours} assigned to you` : undefined} />
        <Stat value={pad2(reviewCount)} label="Essays to review" tone={reviewCount ? 'amber' : 'neutral'} />
        <Stat value={pad2(overdueCount)} label="Overdue tasks" tone={overdueCount ? 'red' : 'neutral'} />
        <Stat
          value={msg.error ? 'n/a' : pad2(awaiting.size)}
          label="Awaiting reply"
          tone={!msg.error && awaiting.size ? 'accent' : 'neutral'}
          sub={msg.error ? 'Messages did not load' : undefined}
        />
        <Stat value={pad2(soonCount)} label={`Deadlines, ${SOON_DAYS} days`} tone={soonCount ? 'amber' : 'neutral'} />
      </StatRow>

      <section aria-labelledby="radar-heading" className="mb-16">
        <SectionLabel
          action={
            laterCount > 0 ? (
              <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim">
                {laterCount} later
              </span>
            ) : undefined
          }
        >
          <span id="radar-heading">Deadline radar, next {RADAR_DAYS} days</span>
        </SectionLabel>
        <RadarLegend />
        <div className="hidden sm:block">
          <DeadlineRadar items={radarItems} now={now} onOpen={openSchool} />
        </div>
        <div className="sm:hidden">
          <RadarList items={radarItems} onOpen={openSchool} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-0">
        <section aria-labelledby="attention-heading" className="min-w-0 lg:pr-10">
          <SectionLabel
            action={
              attention.length > 0 ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">{pad2(attention.length)}</span>
              ) : undefined
            }
          >
            <span id="attention-heading">Needs attention</span>
          </SectionLabel>
          {msg.error && (
            <p role="alert" className="mb-3 border-l-2 border-portal-red pl-3 text-xs text-portal-muted">
              Messages could not load, so unanswered threads are not listed. {msg.error}
            </p>
          )}
          {attention.length === 0 ? (
            <div className="flex items-center gap-3 border-y border-portal-line py-6 text-sm text-portal-muted">
              <Diamond size={8} color={toneColor.green} />
              All caught up. Nothing needs you right now.
            </div>
          ) : (
            <>
              <ul className="stagger border-t border-portal-line-strong">
                {visibleAttention.map((item) => (
                  <AttentionRow key={item.key} item={item} onOpen={() => open(item.target)} />
                ))}
              </ul>
              {(hiddenCount > 0 || showAll) && attention.length > ATTENTION_LIMIT && (
                <div className="flex items-center justify-between gap-3 pt-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim">
                    {hiddenCount > 0 ? `${hiddenCount} more` : `Showing all ${attention.length}`}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
                    {showAll ? 'Show fewer' : 'Show all'}
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="upcoming-heading" className="min-w-0 lg:border-l lg:border-portal-line lg:pl-10">
          <SectionLabel>
            <span id="upcoming-heading">Upcoming deadlines</span>
          </SectionLabel>
          <UpcomingTable items={deadlines.slice(0, UPCOMING_LIMIT)} onOpen={openSchool} />
        </section>
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
   Deadline radar
   -------------------------------------------------------------------------- */
const LANE = 30;
const HIT = 32;
const BASE = 8;

function RadarLegend() {
  const entries: { tone: Tone; label: string }[] = [
    { tone: 'red', label: '3 days or less' },
    { tone: 'amber', label: 'This week' },
    { tone: 'accent', label: 'Two weeks' },
    { tone: 'neutral', label: 'Later' },
  ];
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em] text-portal-dim">
      {entries.map((e) => (
        <span key={e.tone} className="inline-flex items-center gap-2">
          <Diamond size={7} color={toneColor[e.tone]} />
          {e.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-2">
        <Diamond size={7} filled={false} color={toneColor.neutral} />
        Essays all final
      </span>
    </div>
  );
}

function DeadlineRadar({ items, now, onOpen }: { items: Deadline[]; now: Date; onOpen: (d: Deadline) => void }) {
  // Greedy lanes: deadlines within a day of each other stack upward.
  const placed = useMemo(() => {
    const laneLast: number[] = [];
    return items.map((item) => {
      let lane = laneLast.findIndex((last) => last < item.days - 1);
      if (lane === -1) {
        lane = laneLast.length;
        laneLast.push(item.days);
      } else {
        laneLast[lane] = item.days;
      }
      return { item, lane };
    });
  }, [items]);

  const lanes = Math.max(3, ...placed.map((p) => p.lane + 1));
  const height = lanes * LANE + BASE + 6;
  const ticks = Array.from({ length: RADAR_DAYS + 1 }, (_, d) => d);
  const labelFor = (d: number) =>
    d === 0
      ? 'Today'
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() + d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="px-4">
      <div className="relative" style={{ height }}>
        {/* Week guides */}
        {[7, 14, 21, 28].map((d) => (
          <span
            key={d}
            aria-hidden="true"
            className="absolute bottom-0 top-0 w-px bg-portal-line"
            style={{ left: `${(d / RADAR_DAYS) * 100}%` }}
          />
        ))}
        {/* Today */}
        <span aria-hidden="true" className="absolute bottom-0 top-0 left-0 w-px bg-portal-accent" />
        <span aria-hidden="true" className="absolute left-0 top-0 h-[3px] w-3 bg-portal-accent" />

        {placed.length === 0 && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-portal-muted">
            No school deadlines in the next {RADAR_DAYS} days.
          </p>
        )}

        <ul className="stagger absolute inset-0" aria-label={`School deadlines in the next ${RADAR_DAYS} days`}>
          {placed.map(({ item, lane }) => {
            const pct = (item.days / RADAR_DAYS) * 100;
            const bottom = BASE + lane * LANE;
            const tone = urgencyTone(item.days);
            const ready = item.total > 0 && item.done >= item.total;
            const name = nameOf(item.student);
            // Tooltip sits beside the diamond so it never hides the rest of a stack. It opens
            // toward the middle so a long school name never pushes past the panel edge.
            const align = pct > 50 ? 'right-full mr-1' : 'left-full ml-1';
            return (
              <li
                key={item.key}
                className="group absolute hover:z-20 focus-within:z-20"
                style={{ left: `${pct}%`, bottom, width: HIT, height: HIT, marginLeft: -HIT / 2 }}
              >
                {/* Crosshair drop line to the axis */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 w-0 border-l border-dashed opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                  style={{ top: HIT - 6, height: bottom + 6, borderColor: toneColor[tone] }}
                />
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  aria-label={`${name}, ${item.school.name}, due ${formatDate(item.school.deadline, { month: 'long', day: 'numeric' })}, ${relativeDays(item.school.deadline).toLowerCase()}. ${item.done} of ${plural(item.total, 'essay')} final.`}
                  className="flex h-full w-full items-center justify-center transition-transform duration-150 ease-portal hover:scale-125 focus-visible:scale-125"
                >
                  <Diamond size={12} color={toneColor[tone]} filled={!ready} />
                </button>
                <span
                  role="presentation"
                  className={cx(
                    'pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 whitespace-nowrap border border-portal-line-strong bg-portal-bg px-3 py-2 text-left opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
                    align,
                  )}
                >
                  <span className="block text-sm text-portal-text">{name}</span>
                  <span className="block text-xs text-portal-body">{item.school.name}</span>
                  <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: toneColor[tone] }}>
                    {formatDate(item.school.deadline, { weekday: 'short', month: 'short', day: 'numeric' })}, {relativeDays(item.school.deadline)}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-portal-dim">
                    {item.total ? `${item.done}/${item.total} essays final` : 'No essays'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Axis */}
      <div aria-hidden="true" className="relative h-9 border-t border-portal-line-strong">
        {ticks.map((d) => (
          <span
            key={d}
            className={cx('absolute top-0 w-px', d % 7 === 0 ? 'h-2 bg-portal-muted' : 'h-1 bg-portal-line-strong')}
            style={{ left: `${(d / RADAR_DAYS) * 100}%` }}
          />
        ))}
        {[0, 7, 14, 21, 28].map((d) => (
          <span
            key={d}
            className={cx(
              'absolute top-3 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em]',
              d === 0 ? 'text-portal-accent-light' : '-translate-x-1/2 text-portal-dim',
            )}
            style={{ left: `${(d / RADAR_DAYS) * 100}%` }}
          >
            {labelFor(d)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Small screens: the radar becomes a plain ruled list. */
function RadarList({ items, onOpen }: { items: Deadline[]; onOpen: (d: Deadline) => void }) {
  if (items.length === 0) {
    return <p className="border-y border-portal-line py-5 text-sm text-portal-muted">No school deadlines in the next {RADAR_DAYS} days.</p>;
  }
  return (
    <ul className="border-t border-portal-line-strong">
      {items.map((item) => {
        const tone = urgencyTone(item.days);
        const ready = item.total > 0 && item.done >= item.total;
        return (
          <li key={item.key} className="border-b border-portal-line">
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="flex min-h-12 w-full items-center gap-3 py-3 text-left transition-colors hover:bg-portal-hover"
            >
              <Diamond size={9} color={toneColor[tone]} filled={!ready} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-portal-text">{item.school.name}</span>
                <span className="block truncate text-xs text-portal-muted">{nameOf(item.student)}</span>
              </span>
              <span className="whitespace-nowrap font-mono text-[11px]" style={{ color: toneColor[tone] }}>
                {relativeDays(item.school.deadline)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------------------------------------------------------
   Needs attention
   -------------------------------------------------------------------------- */
function AttentionRow({ item, onOpen }: { item: AttentionItem; onOpen: () => void }) {
  const name = nameOf(item.student);
  return (
    <li className="border-b border-portal-line">
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-start gap-4 py-4 text-left transition-colors hover:bg-portal-hover sm:items-center sm:px-2"
      >
        <Avatar initials={item.student?.avatar_initials ?? ''} size={32} tone={item.tone} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-medium text-portal-text">{name}</span>
            <Tag tone={item.tone}>{item.tag}</Tag>
          </span>
          <span className="mt-1 block truncate text-sm text-portal-body">{item.title}</span>
          <span className="mt-0.5 block truncate text-xs text-portal-muted">{item.detail}</span>
          <span className="mt-1 block font-mono text-[11px] text-portal-dim sm:hidden">{item.meta}</span>
        </span>
        <span className="flex flex-none items-center gap-3 self-center">
          <span className="hidden whitespace-nowrap font-mono text-[11px] text-portal-muted sm:inline">{item.meta}</span>
          <IconChevronRight size={14} className="text-portal-dim transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-portal-text" />
        </span>
      </button>
    </li>
  );
}

/* --------------------------------------------------------------------------
   Upcoming deadlines
   -------------------------------------------------------------------------- */
function UpcomingTable({ items, onOpen }: { items: Deadline[]; onOpen: (d: Deadline) => void }) {
  if (items.length === 0) {
    return <p className="border-y border-portal-line py-5 text-sm text-portal-muted">No upcoming school deadlines.</p>;
  }
  return (
    <div>
      <div className="grid grid-cols-[48px_minmax(0,1fr)_auto] gap-4 border-b border-portal-line-strong pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim">
        <span>Date</span>
        <span>School</span>
        <span className="text-right">Essays</span>
      </div>
      <ul className="stagger">
        {items.map((item) => {
          const tone = urgencyTone(item.days);
          const plan = item.school.decision_plan?.trim();
          return (
            <li key={item.key} className="border-b border-portal-line">
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="grid w-full grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-4 py-3 text-left transition-colors hover:bg-portal-hover"
              >
                <span className="font-mono leading-none">
                  <span className="block text-lg font-bold tabular-nums text-portal-text">
                    {formatDate(item.school.deadline, { day: 'numeric' })}
                  </span>
                  <span className="mt-1 block text-[10px] uppercase tracking-[0.14em] text-portal-muted">
                    {formatDate(item.school.deadline, { month: 'short' })}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm text-portal-text">{item.school.name}</span>
                    {plan && <Tag className="flex-none">{plan}</Tag>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-portal-muted">
                    {nameOf(item.student)}
                    <span className="ml-2 font-mono" style={{ color: toneColor[tone] }}>
                      {relativeDays(item.school.deadline)}
                    </span>
                  </span>
                </span>
                <span className="text-right font-mono text-[11px] tabular-nums text-portal-body">
                  {item.total ? `${item.done}/${item.total}` : <span className="text-portal-dim">None</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
