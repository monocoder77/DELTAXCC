'use client';

/* ==========================================================================
   Schools & Essays: a ruled table of the student's schools with deadlines
   and a diamond per essay. Selecting a school opens SchoolDetail.
   ========================================================================== */

import { useCallback, useMemo, useState } from 'react';
import { useApplications, useNow } from '@/lib/hooks';
import type { SchoolWithEssays } from '@/lib/hooks';
import type { SchoolCategory } from '@/types/database';
import type { StudentPanelProps } from './nav';
import SchoolDetail, { SchoolFormDialog, essayStatusOf, isEssayDone, isSchoolOverdue } from './SchoolDetail';
import {
  Button,
  CategoryTag,
  EmptyState,
  LoadingBlock,
  Panel,
  PanelHeader,
  SegmentBar,
  Stat,
  StatRow,
  StatusGlyph,
  Tag,
  cx,
  daysUntil,
  formatDate,
  pad2,
  relativeDays,
  toneColor,
} from './ui/primitives';
import { IconChevronRight, IconPlus } from './ui/icons';

type Filter = 'all' | SchoolCategory;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'reach', label: 'Reach' },
  { id: 'target', label: 'Target' },
  { id: 'safety', label: 'Safety' },
];

const FILTER_TONE: Record<Filter, string> = {
  all: toneColor.accent,
  reach: toneColor.red,
  target: toneColor.gold,
  safety: toneColor.green,
};

/** Shared column template so the header and rows line up on desktop. */
const COLS = 'md:grid md:grid-cols-[2.25rem_minmax(0,2.4fr)_6.5rem_4.5rem_minmax(0,1.3fr)_minmax(0,1.3fr)_1.25rem] md:items-center md:gap-4';

const MAX_GLYPHS = 8;

/* --------------------------------------------------------------------------
   Summary strip
   -------------------------------------------------------------------------- */

function Summary({ schools, now }: { schools: SchoolWithEssays[]; now: Date }) {
  const prompts = schools.flatMap((s) => s.prompts);
  const done = prompts.filter(isEssayDone).length;
  const overdue = schools.filter((s) => isSchoolOverdue(s, now)).length;

  // Next school whose deadline is today or later and still has essays open.
  const next = schools
    .filter((s) => {
      const d = daysUntil(s.deadline, now);
      return d !== null && d >= 0 && !s.prompts.every(isEssayDone);
    })
    .sort((a, b) => (daysUntil(a.deadline, now) ?? 0) - (daysUntil(b.deadline, now) ?? 0))[0];
  const nextDays = next ? daysUntil(next.deadline, now) : null;

  return (
    <StatRow className="mb-10">
      <Stat value={pad2(schools.length)} label={schools.length === 1 ? 'School' : 'Schools'} />
      <div className="min-w-0">
        <Stat
          value={
            <>
              {done}
              <span className="text-portal-dim">/{prompts.length}</span>
            </>
          }
          tone={prompts.length > 0 && done === prompts.length ? 'green' : 'neutral'}
          label="Essays final"
        />
        <SegmentBar value={done} max={prompts.length} segments={16} tone="green" label="Essays final" className="mt-4 max-w-[200px]" />
      </div>
      {nextDays !== null && next ? (
        <Stat
          value={nextDays === 0 ? 'Today' : pad2(nextDays)}
          tone={nextDays <= 7 ? 'amber' : 'accent'}
          label={nextDays === 0 ? 'Next deadline' : nextDays === 1 ? 'Day to next deadline' : 'Days to next deadline'}
          sub={`${next.name}, ${formatDate(next.deadline)}`}
        />
      ) : (
        <Stat value="--" label="Next deadline" sub="Nothing open with a date" />
      )}
      <Stat value={pad2(overdue)} tone={overdue > 0 ? 'red' : 'neutral'} label="Past deadline" sub={overdue > 0 ? 'Essays still open' : 'All clear'} />
    </StatRow>
  );
}

/* --------------------------------------------------------------------------
   Table
   -------------------------------------------------------------------------- */

function TableHeader() {
  const label = 'font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim';
  return (
    <div className={cx('hidden border-b border-portal-line-strong pb-3', COLS)} aria-hidden="true">
      <span className={label}>No.</span>
      <span className={label}>School</span>
      <span className={label}>Category</span>
      <span className={label}>Plan</span>
      <span className={label}>Deadline</span>
      <span className={label}>Essays</span>
      <span />
    </div>
  );
}

function SchoolRow({ school, index, now, onOpen }: { school: SchoolWithEssays; index: number; now: Date; onOpen: () => void }) {
  const overdue = isSchoolOverdue(school, now);
  const days = daysUntil(school.deadline, now);
  const soon = !overdue && days !== null && days >= 0 && days <= 7 && !school.prompts.every(isEssayDone);
  const done = school.prompts.filter(isEssayDone).length;
  const shown = school.prompts.slice(0, MAX_GLYPHS);
  const extra = school.prompts.length - shown.length;
  const plan = school.decision_plan?.trim();

  return (
    <li className="border-b border-portal-line">
      <button
        type="button"
        onClick={onOpen}
        className={cx('group relative block w-full px-1 py-4 text-left transition-colors hover:bg-portal-hover md:py-5', COLS)}
      >
        {/* Hover marker: a short accent rule that draws down the left edge. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[2px] origin-top scale-y-0 bg-portal-accent transition-transform duration-300 ease-portal group-hover:scale-y-100"
        />

        <span className="hidden font-mono text-xs tabular-nums text-portal-dim transition-colors group-hover:text-portal-accent-light md:block md:pl-2">
          {pad2(index + 1)}
        </span>

        {/* School + program (on mobile this block carries everything) */}
        <span className="flex min-w-0 items-start justify-between gap-3 pl-3 md:block md:pl-0">
          <span className="min-w-0">
            <span className="block truncate font-serif text-[17px] leading-snug text-portal-text">{school.name}</span>
            {school.program && <span className="mt-0.5 block truncate text-[13px] text-portal-muted">{school.program}</span>}
          </span>
          <IconChevronRight size={16} className="mt-1 flex-none text-portal-dim md:hidden" />
        </span>

        <span className="mt-3 flex flex-wrap items-center gap-2 pl-3 md:mt-0 md:pl-0">
          {school.is_common_app ? <Tag tone="accent">Common App</Tag> : <CategoryTag category={school.category} />}
          {plan && <span className="md:hidden"><Tag>{plan}</Tag></span>}
        </span>

        <span className="hidden truncate font-mono text-xs text-portal-body md:block">
          {plan || <span className="text-portal-dim">None</span>}
          <span className="sr-only"> plan</span>
        </span>

        <span className="mt-3 flex items-baseline gap-2 pl-3 md:mt-0 md:block md:pl-0">
          <span className={cx('font-mono text-xs tabular-nums', overdue ? 'text-portal-red' : school.deadline ? 'text-portal-text' : 'text-portal-dim')}>
            {formatDate(school.deadline)}
          </span>
          {school.deadline && (
            <span
              className={cx(
                'font-mono text-[10px] uppercase tracking-[0.12em] md:mt-1 md:block',
                overdue ? 'text-portal-red' : soon ? 'text-portal-amber' : 'text-portal-dim',
              )}
            >
              {relativeDays(school.deadline)}
              {overdue && ', essays open'}
            </span>
          )}
        </span>

        <span className="mt-3 flex items-center gap-3 pl-3 md:mt-0 md:pl-0">
          {school.prompts.length === 0 ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-portal-dim">No prompts</span>
          ) : (
            <>
              <span className="flex items-center gap-[7px]" aria-hidden="true">
                {shown.map((p) => (
                  <StatusGlyph key={p.id} status={essayStatusOf(p)} size={9} />
                ))}
                {extra > 0 && <span className="font-mono text-[10px] text-portal-dim">+{extra}</span>}
              </span>
              <span className={cx('font-mono text-xs tabular-nums', done === school.prompts.length ? 'text-portal-green' : 'text-portal-muted')}>
                {done}/{school.prompts.length}
                <span className="sr-only"> essays final</span>
              </span>
            </>
          )}
        </span>

        <IconChevronRight
          size={16}
          className="hidden text-portal-dim transition-transform duration-300 ease-portal group-hover:translate-x-1 group-hover:text-portal-accent-light md:block"
        />
      </button>
    </li>
  );
}

/* --------------------------------------------------------------------------
   SchoolsPanel
   -------------------------------------------------------------------------- */

export default function SchoolsPanel({ studentId, viewer, onNavigate, focus }: StudentPanelProps) {
  const app = useApplications([studentId]);
  const now = useNow();
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  // Stable: the shared Dialog refocuses whenever onClose changes identity.
  const closeAdd = useCallback(() => setAdding(false), []);

  // Selected school follows the deep link, and clicks update both state and URL.
  const focusSchoolId = focus?.schoolId;
  const [selectedId, setSelectedId] = useState<string | null>(focusSchoolId ?? null);
  const [seenFocus, setSeenFocus] = useState(focusSchoolId);
  if (seenFocus !== focusSchoolId) {
    setSeenFocus(focusSchoolId);
    setSelectedId(focusSchoolId ?? null);
  }

  const schools = app.schoolsWithEssays;
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, reach: 0, target: 0, safety: 0 };
    for (const s of schools) {
      c.all += 1;
      if (!s.is_common_app) c[s.category] += 1;
    }
    return c;
  }, [schools]);

  const visible = filter === 'all' ? schools : schools.filter((s) => !s.is_common_app && s.category === filter);
  const selected = selectedId ? schools.find((s) => s.id === selectedId) : undefined;
  const hasData = schools.length > 0;

  const openSchool = (id: string) => {
    setSelectedId(id);
    onNavigate('schools', { schoolId: id });
  };
  const backToList = () => {
    setSelectedId(null);
    onNavigate('schools', {});
  };

  const addButton = (
    <Button variant="primary" onClick={() => setAdding(true)}>
      <IconPlus size={16} />
      Add school
    </Button>
  );

  const addDialog = adding && (
    <SchoolFormDialog
      title="Add a school"
      submitLabel="Add school"
      onSubmit={(values) => app.addSchool(studentId, values)}
      onClose={closeAdd}
    />
  );

  if (app.loading && !hasData) {
    return (
      <Panel>
        <PanelHeader index="02" eyebrow="Applications" title="Schools & Essays" />
        <LoadingBlock label="Loading schools" />
      </Panel>
    );
  }

  if (app.error && !hasData) {
    return (
      <Panel>
        <PanelHeader index="02" eyebrow="Applications" title="Schools & Essays" />
        <div role="alert" className="flex flex-wrap items-center justify-between gap-4 border-y border-portal-red/40 py-5">
          <p className="text-sm text-portal-red">Schools could not be loaded. {app.error}</p>
          <Button size="sm" variant="outline" onClick={app.reload}>
            Try again
          </Button>
        </div>
      </Panel>
    );
  }

  if (selected) {
    return (
      <SchoolDetail
        key={selected.id}
        school={selected}
        app={app}
        studentId={studentId}
        viewer={viewer}
        onBack={backToList}
        focusPromptId={focus?.schoolId === selected.id ? focus?.promptId : undefined}
      />
    );
  }

  const missingFocus = Boolean(selectedId) && !app.loading;

  return (
    <Panel>
      <PanelHeader
        index="02"
        eyebrow="Applications"
        title="Schools & Essays"
        description={
          viewer === 'counselor'
            ? 'Every school on this student’s list, with deadlines and where each essay stands.'
            : 'Every school on your list, with deadlines and where each essay stands. Open a school to write.'
        }
        actions={hasData ? addButton : undefined}
      />

      {app.error && (
        <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 border-l-2 border-portal-red pl-3">
          <p className="text-sm text-portal-red">Some changes could not be refreshed. {app.error}</p>
          <Button size="sm" variant="ghost" onClick={app.reload}>
            Retry
          </Button>
        </div>
      )}

      {missingFocus && (
        <p className="mb-6 border-l-2 border-portal-amber pl-3 text-sm text-portal-amber" role="status">
          That school is no longer on the list. It may have been removed.
        </p>
      )}

      {!hasData ? (
        <EmptyState
          title="No schools yet"
          body={
            viewer === 'counselor'
              ? 'Add the first school this student is applying to. Deadlines and essays for each school will live here.'
              : 'Add the first school you are applying to. Deadlines and essays for each school will live here.'
          }
          action={addButton}
        />
      ) : (
        <>
          <Summary schools={schools} now={now} />

          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
              {FILTERS.map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(f.id)}
                    className={cx(
                      'inline-flex h-8 items-center gap-2 border px-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors',
                      active ? 'border-portal-accent bg-portal-select text-portal-text' : 'border-portal-line text-portal-muted hover:border-portal-line-strong hover:text-portal-text',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block h-[6px] w-[6px] rotate-45"
                      style={{ background: active ? FILTER_TONE[f.id] : 'transparent', border: `1px solid ${FILTER_TONE[f.id]}` }}
                    />
                    {f.label}
                    <span className="tabular-nums text-portal-dim">{counts[f.id]}</span>
                  </button>
                );
              })}
            </div>
            <p className="font-mono text-[11px] text-portal-muted">
              {counts.reach} reach, {counts.target} target, {counts.safety} safety
              {schools.some((s) => s.is_common_app) ? ', plus Common App' : ''}
            </p>
          </div>

          <TableHeader />
          {visible.length === 0 ? (
            <p className="border-b border-portal-line py-10 text-center text-sm text-portal-muted">
              No {filter} schools on the list yet.
            </p>
          ) : (
            <ul className="stagger" key={filter}>
              {visible.map((school, i) => (
                <SchoolRow key={school.id} school={school} index={i} now={now} onOpen={() => openSchool(school.id)} />
              ))}
            </ul>
          )}
        </>
      )}

      {addDialog}
    </Panel>
  );
}
