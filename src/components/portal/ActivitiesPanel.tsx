'use client';

/* ==========================================================================
   Activities: the Common App list of up to ten. A numbered, ruled list with
   big mono indexes (also the drag handle), the empty slots left in the
   budget drawn as ghost rows, and one inline editor at a time with the
   official Common App character limits.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent, ReactNode } from 'react';
import { MAX_ACTIVITIES, errorMessage, useActivities } from '@/lib/hooks';
import type { Activity } from '@/types/database';
import type { StudentPanelProps } from './nav';
import {
  Button,
  Dialog,
  Diamond,
  EmptyState,
  Field,
  IconButton,
  Input,
  LineMeter,
  LoadingBlock,
  Panel,
  PanelHeader,
  SegmentBar,
  Select,
  Tag,
  Textarea,
  cx,
  pad2,
} from './ui/primitives';
import { IconArrowDown, IconArrowUp, IconCheck, IconChevronDown, IconPlus, IconTrash } from './ui/icons';

/* --------------------------------------------------------------------------
   Common App rules
   -------------------------------------------------------------------------- */
const LIMITS = { role: 50, organization: 100, description: 150 } as const;

const ACTIVITY_TYPES = [
  'Academic',
  'Art',
  'Athletics: Club',
  'Athletics: JV/Varsity',
  'Career Oriented',
  'Community Service (Volunteer)',
  'Computer/Technology',
  'Cultural',
  'Dance',
  'Debate/Speech',
  'Environmental',
  'Family Responsibilities',
  'Foreign Exchange',
  'Internship',
  'Journalism/Publication',
  'Junior R.O.T.C.',
  'LGBT',
  'Music: Instrumental',
  'Music: Vocal',
  'Religious',
  'Research',
  'Robotics',
  'School Spirit',
  'Science/Math',
  'Social Justice',
  'Student Govt./Politics',
  'Theater/Drama',
  'Work (Paid)',
  'Other Club/Activity',
];

const TIMINGS = ['School year', 'School break', 'All year'];
const GRADES = [9, 10, 11, 12] as const;
const MAX_HOURS = 168;
const MAX_WEEKS = 52;

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

/** Text columns are nullable in the database; treat null as empty. */
function str(value: string | null | undefined): string {
  return value ?? '';
}

function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function totalHours(a: Activity): number {
  return num(a.hours_per_week) * num(a.weeks_per_year);
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * Read grade levels from whatever was stored: "9, 10, 11", "9-12",
 * "10th, 11th", "Grades 9 through 12", "junior, senior" all work.
 */
function parseGrades(value: string | null | undefined): Set<number> {
  const out = new Set<number>();
  const text = str(value).toLowerCase();
  const add = (n: number) => {
    if (n >= 9 && n <= 12) out.add(n);
  };
  for (const m of text.matchAll(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|\u2013|\u2014|to|through|thru)\s*(\d{1,2})/g)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    for (let g = Math.min(a, b); g <= Math.max(a, b); g++) add(g);
  }
  for (const m of text.matchAll(/\d{1,2}/g)) add(Number(m[0]));
  const words: Record<string, number> = { freshman: 9, sophomore: 10, junior: 11, senior: 12 };
  for (const [word, grade] of Object.entries(words)) if (text.includes(word)) add(grade);
  return out;
}

function formatGrades(grades: Set<number>): string {
  return [...grades].sort((a, b) => a - b).join(', ');
}

function gradesLabel(value: string | null | undefined): string {
  const g = parseGrades(value);
  return g.size ? `Gr ${formatGrades(g)}` : '';
}

/** Plain text block for one activity, ready to paste field by field. */
function activityText(a: Activity): string {
  return [
    `Position/leadership: ${str(a.role)}`,
    `Organization: ${str(a.organization)}`,
    `Description: ${str(a.description)}`,
  ].join('\n');
}

function allActivitiesText(list: Activity[]): string {
  return list
    .map((a, i) => {
      const grades = formatGrades(parseGrades(a.grade_levels));
      const details = [
        grades && `Grades: ${grades}`,
        str(a.timing) && `Timing: ${str(a.timing)}`,
        `${num(a.hours_per_week)} hrs/week, ${num(a.weeks_per_year)} weeks/year`,
      ]
        .filter(Boolean)
        .join(' | ');
      return [
        `${pad2(i + 1)}. ${str(a.activity_name) || 'Untitled activity'}`,
        `Activity type: ${str(a.activity_type)}`,
        activityText(a),
        details,
      ].join('\n');
    })
    .join('\n\n');
}

/**
 * Let a paste go past maxLength so nothing is silently cut off; the counter
 * turns red and the student trims it. Typing past the limit stays blocked.
 */
function pastePastLimit(
  e: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  limit: number,
  commit: (value: string) => void,
  singleLine: boolean,
) {
  const el = e.currentTarget;
  let text = e.clipboardData.getData('text/plain');
  if (singleLine) text = text.replace(/\s*\r?\n\s*/g, ' ');
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  if (next.length <= limit) return;
  e.preventDefault();
  commit(next);
  const caret = start + text.length;
  requestAnimationFrame(() => {
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      /* element may have unmounted */
    }
  });
}

function Counter({ value, limit }: { value: number; limit: number }) {
  const over = value > limit;
  const near = !over && value >= Math.round(limit * 0.9);
  return (
    <span className={cx('tabular-nums', over ? 'text-portal-red' : near ? 'text-portal-amber' : 'text-portal-dim')}>
      {value}/{limit}
      {over && <span className="sr-only"> characters, over the Common App limit</span>}
    </span>
  );
}

function MicroLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted', className)}>{children}</span>;
}

/* --------------------------------------------------------------------------
   Clipboard with a short "Copied" state
   -------------------------------------------------------------------------- */
type CopyState = { key: string; ok: boolean } | null;

function useCopy() {
  const [state, setState] = useState<CopyState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async (key: string, text: string) => {
    let ok = false;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = false;
    }
    setState({ key, ok });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(null), ok ? 1600 : 3200);
  }, []);

  return { state, copy };
}

function CopyButton({
  copyKey,
  state,
  onCopy,
  label,
  ariaLabel,
  size = 'sm',
  variant = 'ghost',
}: {
  copyKey: string;
  state: CopyState;
  onCopy: () => void;
  label: string;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'outline';
}) {
  const mine = state?.key === copyKey ? state : null;
  return (
    <Button variant={variant} size={size} onClick={onCopy} aria-label={mine ? undefined : ariaLabel} className={cx(mine && !mine.ok && 'text-portal-red')}>
      {mine?.ok ? (
        <>
          <IconCheck size={14} className="text-portal-green" />
          Copied
        </>
      ) : mine ? (
        'Copy failed'
      ) : (
        label
      )}
    </Button>
  );
}

/* --------------------------------------------------------------------------
   Number input that can be cleared while typing; commits a clamped integer
   -------------------------------------------------------------------------- */
function NumberField({
  id,
  label,
  value,
  max,
  suffix,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  max: number;
  suffix: string;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);

  const finish = () => {
    if (draft === null) return;
    const n = draft === '' ? 0 : Math.min(max, Math.max(0, Math.round(Number(draft))));
    const clean = Number.isFinite(n) ? n : 0;
    if (clean !== value) onCommit(clean);
    setDraft(null);
  };

  return (
    <Field label={label} htmlFor={id} hint={`0 to ${max} ${suffix}`}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={shown}
        onFocus={() => setDraft(String(value))}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 3);
          setDraft(digits);
          if (digits !== '') {
            const n = Number(digits);
            if (n <= max && n !== value) onCommit(n);
          }
        }}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="font-mono tabular-nums"
      />
    </Field>
  );
}

/* --------------------------------------------------------------------------
   Inline editor
   -------------------------------------------------------------------------- */
function ActivityEditor({
  activity,
  editorId,
  autoFocus,
  onChange,
  onClose,
  onDelete,
  copyState,
  onCopy,
}: {
  activity: Activity;
  editorId: string;
  autoFocus: boolean;
  onChange: (updates: Partial<Activity>) => void;
  onClose: () => void;
  onDelete: () => void;
  copyState: CopyState;
  onCopy: () => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const id = (field: string) => `${editorId}-${field}`;
  const type = str(activity.activity_type);
  const timing = str(activity.timing);
  const role = str(activity.role);
  const organization = str(activity.organization);
  const description = str(activity.description);
  const grades = parseGrades(activity.grade_levels);
  const hours = num(activity.hours_per_week);
  const weeks = num(activity.weeks_per_year);

  useEffect(() => {
    if (!autoFocus) return;
    nameRef.current?.focus();
    nameRef.current?.select();
  }, [autoFocus]);

  const toggleGrade = (g: number) => {
    const next = new Set(grades);
    if (next.has(g)) next.delete(g);
    else next.add(g);
    onChange({ grade_levels: formatGrades(next) });
  };

  return (
    <div id={editorId} className="animate-rise border-t border-portal-line pb-8 pl-4 pr-2 pt-6 sm:pl-[92px] sm:pr-4">
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <Field label="Activity name" htmlFor={id('name')} hint="Your own label. It is not sent to colleges.">
          <Input
            ref={nameRef}
            id={id('name')}
            value={str(activity.activity_name)}
            onChange={(e) => onChange({ activity_name: e.target.value })}
            placeholder="Robotics team"
          />
        </Field>

        <Field label="Activity type" htmlFor={id('type')}>
          <Select id={id('type')} value={type} onChange={(e) => onChange({ activity_type: e.target.value })}>
            {type === '' && (
              <option value="" disabled>
                Choose a type
              </option>
            )}
            {type !== '' && !ACTIVITY_TYPES.includes(type) && <option value={type}>{type}</option>}
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Position / leadership" htmlFor={id('role')} counter={<Counter value={role.length} limit={LIMITS.role} />}>
          <Input
            id={id('role')}
            value={role}
            maxLength={LIMITS.role}
            onChange={(e) => onChange({ role: e.target.value })}
            onPaste={(e) => pastePastLimit(e, LIMITS.role, (v) => onChange({ role: v }), true)}
            placeholder="Captain, lead designer"
            aria-invalid={role.length > LIMITS.role || undefined}
          />
        </Field>

        <Field
          label="Organization"
          htmlFor={id('org')}
          counter={<Counter value={organization.length} limit={LIMITS.organization} />}
        >
          <Input
            id={id('org')}
            value={organization}
            maxLength={LIMITS.organization}
            onChange={(e) => onChange({ organization: e.target.value })}
            onPaste={(e) => pastePastLimit(e, LIMITS.organization, (v) => onChange({ organization: v }), true)}
            placeholder="Westlake High School"
            aria-invalid={organization.length > LIMITS.organization || undefined}
          />
        </Field>

        <Field
          label="Description"
          htmlFor={id('desc')}
          className="sm:col-span-2"
          counter={<Counter value={description.length} limit={LIMITS.description} />}
          error={
            description.length > LIMITS.description
              ? `${description.length - LIMITS.description} characters over. The Common App stops at ${LIMITS.description}.`
              : undefined
          }
          hint="Lead with what you did and what changed because of it. Numbers help."
        >
          <Textarea
            id={id('desc')}
            value={description}
            rows={3}
            maxLength={LIMITS.description}
            onChange={(e) => onChange({ description: e.target.value })}
            onPaste={(e) => pastePastLimit(e, LIMITS.description, (v) => onChange({ description: v }), false)}
            aria-invalid={description.length > LIMITS.description || undefined}
            className="min-h-[88px]"
          />
          <LineMeter value={description.length} max={LIMITS.description} className="mt-2" />
        </Field>

        <div className="min-w-0">
          <p id={id('grades')} className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">
            Participation grade levels
          </p>
          <div role="group" aria-labelledby={id('grades')} className="flex gap-2">
            {GRADES.map((g) => {
              const on = grades.has(g);
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Grade ${g}`}
                  onClick={() => toggleGrade(g)}
                  className={cx(
                    'h-10 w-12 border font-mono text-sm tabular-nums transition-colors duration-150',
                    on
                      ? 'border-portal-accent bg-portal-accent/20 text-portal-text'
                      : 'border-portal-line-strong text-portal-muted hover:border-portal-accent-light hover:text-portal-text',
                  )}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Timing of participation" htmlFor={id('timing')}>
          <Select id={id('timing')} value={timing} onChange={(e) => onChange({ timing: e.target.value })}>
            {timing === '' && (
              <option value="" disabled>
                Choose timing
              </option>
            )}
            {timing !== '' && !TIMINGS.includes(timing) && <option value={timing}>{timing}</option>}
            {TIMINGS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <NumberField
          id={id('hours')}
          label="Hours per week"
          value={hours}
          max={MAX_HOURS}
          suffix="hours"
          onCommit={(n) => onChange({ hours_per_week: n })}
        />
        <NumberField
          id={id('weeks')}
          label="Weeks per year"
          value={weeks}
          max={MAX_WEEKS}
          suffix="weeks"
          onCommit={(n) => onChange({ weeks_per_year: n })}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-portal-line pt-5">
        <p className="font-mono text-[11px] text-portal-dim">
          {hours} hrs x {weeks} wks = <span className="text-portal-accent-light">{formatCount(hours * weeks)}</span> hours a year
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="danger" size="sm" onClick={onDelete}>
            <IconTrash size={14} />
            Delete
          </Button>
          <CopyButton copyKey={activity.id} state={copyState} onCopy={onCopy} label="Copy for Common App" variant="outline" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   One row of the list
   -------------------------------------------------------------------------- */
function ActivityRow({
  activity,
  index,
  count,
  expanded,
  autoFocus,
  maxImpact,
  dragging,
  dropEdge,
  copyState,
  onToggle,
  onChange,
  onMove,
  onDelete,
  onCopy,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  activity: Activity;
  index: number;
  count: number;
  expanded: boolean;
  autoFocus: boolean;
  maxImpact: number;
  dragging: boolean;
  dropEdge: 'top' | 'bottom' | null;
  copyState: CopyState;
  onToggle: () => void;
  onChange: (updates: Partial<Activity>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onCopy: () => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLLIElement>) => void;
  onDrop: (e: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}) {
  const editorId = `activity-editor-${activity.id}`;
  const name = str(activity.activity_name) || 'Untitled activity';
  const role = str(activity.role);
  const org = str(activity.organization);
  const grades = gradesLabel(activity.grade_levels);
  const hours = num(activity.hours_per_week);
  const weeks = num(activity.weeks_per_year);
  const impact = totalHours(activity);
  const overLimit =
    role.length > LIMITS.role || org.length > LIMITS.organization || str(activity.description).length > LIMITS.description;
  const noDescription = str(activity.description).trim() === '';

  return (
    <li
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cx(
        'group relative border-b border-portal-line transition-opacity duration-150',
        dragging && 'opacity-40',
        expanded && 'bg-portal-hover',
      )}
    >
      {dropEdge && (
        <span
          aria-hidden="true"
          className={cx('absolute inset-x-0 z-10 h-[2px] bg-portal-accent', dropEdge === 'top' ? '-top-px' : '-bottom-px')}
        />
      )}
      {expanded && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[2px] bg-portal-accent" />}

      <div className="flex items-stretch">
        {/* Index: also the drag handle */}
        <div
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          title="Drag to reorder"
          className="relative flex w-14 flex-none cursor-grab select-none items-start justify-start border-r border-portal-line pt-4 active:cursor-grabbing sm:w-[72px]"
        >
          <span
            className={cx(
              'font-mono text-2xl font-bold leading-none tabular-nums transition-colors duration-150 sm:text-[34px]',
              expanded ? 'text-portal-accent-light' : 'text-portal-dim group-hover:text-portal-muted',
            )}
          >
            <span className="sr-only">Activity </span>
            {pad2(index + 1)}
          </span>
        </div>

        {/* Summary: click to expand */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={expanded ? editorId : undefined}
          className="flex min-w-0 flex-1 flex-col gap-2 py-4 pl-4 pr-2 text-left sm:pl-5 md:flex-row md:items-center md:gap-6"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[15px] font-medium text-portal-text">{name}</span>
              {overLimit && <Tag tone="red">Over limit</Tag>}
              {!overLimit && noDescription && (
                <Diamond size={6} filled={false} color="var(--color-portal-amber)" className="ml-1" />
              )}
              {!overLimit && noDescription && <span className="sr-only">(no description yet)</span>}
            </span>
            <span className="mt-1 block truncate text-[13px] text-portal-muted">
              {role || <span className="text-portal-dim">No position yet</span>}
              {org && (
                <>
                  <span className="mx-2 text-portal-dim">/</span>
                  {org}
                </>
              )}
            </span>
          </span>

          <span className="flex flex-none flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] tabular-nums text-portal-muted">
            {grades && <span>{grades}</span>}
            <span>
              {hours}h x {weeks}w
            </span>
            <span className="flex items-center gap-2" title="Total hours per year">
              <span className="relative h-px w-10 bg-portal-line-strong" aria-hidden="true">
                <span
                  className="absolute inset-y-[-1px] left-0 bg-portal-accent-light transition-all duration-500"
                  style={{ width: `${maxImpact > 0 ? (impact / maxImpact) * 100 : 0}%` }}
                />
              </span>
              <span className="text-portal-text">{formatCount(impact)}</span>
              <span className="text-portal-dim">hrs</span>
            </span>
          </span>
        </button>

        {/* Row actions */}
        <div className="flex flex-none items-start gap-0.5 py-3 pr-1 sm:items-center sm:py-0 sm:pr-2">
          <div className="hidden lg:block">
            <CopyButton
              copyKey={activity.id}
              state={copyState}
              onCopy={onCopy}
              label="Copy"
              ariaLabel={`Copy ${name} for the Common App`}
            />
          </div>
          <IconButton
            aria-label={`Move ${name} up`}
            data-move={`${activity.id}:up`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <IconArrowUp size={14} />
          </IconButton>
          <IconButton
            aria-label={`Move ${name} down`}
            data-move={`${activity.id}:down`}
            disabled={index === count - 1}
            onClick={() => onMove(1)}
          >
            <IconArrowDown size={14} />
          </IconButton>
          <IconButton aria-label={expanded ? `Collapse ${name}` : `Edit ${name}`} onClick={onToggle} className="hidden sm:inline-flex">
            <IconChevronDown size={14} className={cx('transition-transform duration-200', expanded && 'rotate-180')} />
          </IconButton>
        </div>
      </div>

      {expanded && (
        <ActivityEditor
          activity={activity}
          editorId={editorId}
          autoFocus={autoFocus}
          onChange={onChange}
          onClose={onToggle}
          onDelete={onDelete}
          copyState={copyState}
          onCopy={onCopy}
        />
      )}
    </li>
  );
}

/* --------------------------------------------------------------------------
   Header strip: N of 10, segment bar, save indicator
   -------------------------------------------------------------------------- */
function BudgetStrip({
  count,
  hoursPerYear,
  saving,
  saveError,
}: {
  count: number;
  hoursPerYear: number;
  saving: boolean;
  saveError: string | null;
}) {
  return (
    <div className="mb-8 grid gap-4 border-b border-portal-line pb-6 md:grid-cols-[auto_1fr_auto] md:items-end md:gap-8">
      <div className="flex items-baseline gap-2 font-mono tabular-nums">
        <span className="text-4xl font-bold leading-none text-portal-text">{pad2(count)}</span>
        <span className="text-[11px] uppercase tracking-[0.16em] text-portal-muted">of {MAX_ACTIVITIES}</span>
      </div>
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-4">
          <MicroLabel>Common App slots</MicroLabel>
          <MicroLabel className="tabular-nums">
            <span className="text-portal-text">{formatCount(hoursPerYear)}</span> hrs a year
          </MicroLabel>
        </div>
        <SegmentBar value={count} max={MAX_ACTIVITIES} segments={MAX_ACTIVITIES} label={`${count} of ${MAX_ACTIVITIES} activities`} />
      </div>
      <div className="min-w-0 md:max-w-[280px] md:text-right">
        {saveError ? (
          <p role="alert" className="font-mono text-[11px] text-portal-red">
            Not saved: {saveError}
          </p>
        ) : (
          <p role="status" aria-live="polite" className="inline-flex items-center gap-2 font-mono text-[11px] text-portal-dim">
            <span
              aria-hidden="true"
              className={cx('inline-block h-1.5 w-1.5 rotate-45', saving ? 'animate-pulse-soft bg-portal-amber' : 'bg-portal-green')}
            />
            {saving ? 'Saving...' : 'All changes saved'}
          </p>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Panel
   -------------------------------------------------------------------------- */
export default function ActivitiesPanel(props: StudentPanelProps) {
  // Keyed by student so a counselor switching students starts with a clean
  // slate (no open editor, dialog or error from the previous student).
  return <ActivitiesList key={props.studentId} studentId={props.studentId} viewer={props.viewer} />;
}

function ActivitiesList({ studentId, viewer }: Pick<StudentPanelProps, 'studentId' | 'viewer'>) {
  const { activities, loading, error, saving, saveError, addActivity, updateActivity, deleteActivity, moveActivity } =
    useActivities(studentId);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusNewId, setFocusNewId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Activity | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFocus = useRef<{ id: string; dir: 'up' | 'down' } | null>(null);
  const { state: copyState, copy } = useCopy();

  const full = activities.length >= MAX_ACTIVITIES;
  const hoursPerYear = useMemo(() => activities.reduce((sum, a) => sum + totalHours(a), 0), [activities]);
  const maxImpact = useMemo(() => activities.reduce((m, a) => Math.max(m, totalHours(a)), 0), [activities]);
  const dragIndex = dragId ? activities.findIndex((a) => a.id === dragId) : -1;

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  // Keep keyboard focus on the arrow the student pressed after a move.
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const btn = document.querySelector<HTMLButtonElement>(`[data-move="${target.id}:${target.dir}"]`);
    const other = document.querySelector<HTMLButtonElement>(`[data-move="${target.id}:${target.dir === 'up' ? 'down' : 'up'}"]`);
    if (btn && !btn.disabled) btn.focus();
    else other?.focus();
  }, [activities]);

  /** The hook saves after a short pause; show "Saving..." from the first keystroke. */
  const change = useCallback(
    (id: string, updates: Partial<Activity>) => {
      updateActivity(id, updates);
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 900);
    },
    [updateActivity],
  );

  const move = (from: number, to: number, focusDir?: 'up' | 'down') => {
    if (to < 0 || to >= activities.length || from === to) return;
    const a = activities[from];
    if (focusDir) pendingFocus.current = { id: a.id, dir: focusDir };
    moveActivity(from, to);
    setAnnouncement(`${str(a.activity_name) || 'Activity'} moved to position ${to + 1} of ${activities.length}.`);
  };

  const handleAdd = async () => {
    setAdding(true);
    setAddError(null);
    try {
      const created = await addActivity();
      if (created) {
        setExpandedId(created.id);
        setFocusNewId(created.id);
      }
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteActivity(confirmDelete.id);
      if (expandedId === confirmDelete.id) setExpandedId(null);
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const closeDialog = useCallback(() => {
    if (deleting) return;
    setConfirmDelete(null);
    setDeleteError(null);
  }, [deleting]);

  const endDrag = () => {
    setDragId(null);
    setOverIndex(null);
  };

  if (loading) {
    return (
      <Panel>
        <LoadingBlock label="Loading activities" />
      </Panel>
    );
  }

  const addButton = (
    <Button variant="primary" onClick={handleAdd} disabled={full || adding}>
      <IconPlus size={16} />
      {adding ? 'Adding...' : 'Add activity'}
    </Button>
  );

  return (
    <Panel>
      <PanelHeader
        index="04"
        eyebrow="Common App"
        title="Activities"
        description={
          viewer === 'counselor'
            ? 'Up to ten, most important first. Your edits save as you type and the student sees them right away.'
            : 'Up to ten, most important first. Everything saves as you type, then copy it straight into the Common App.'
        }
        actions={
          <>
            {activities.length > 0 && (
              <CopyButton
                copyKey="all"
                state={copyState}
                onCopy={() => void copy('all', allActivitiesText(activities))}
                label="Copy all"
                size="md"
                variant="outline"
              />
            )}
            {addButton}
          </>
        }
      />

      {error ? (
        <div role="alert" className="border-y border-portal-red/40 py-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-portal-red">Could not load activities</p>
          <p className="mt-2 text-sm text-portal-body">{error}</p>
        </div>
      ) : (
        <>
          <BudgetStrip count={activities.length} hoursPerYear={hoursPerYear} saving={saving || typing} saveError={saveError} />

          {(addError || full) && (
            <p role={addError ? 'alert' : undefined} className={cx('mb-6 text-sm', addError ? 'text-portal-red' : 'text-portal-muted')}>
              {addError ?? `The Common App holds ${MAX_ACTIVITIES} activities. Remove one to add another.`}
            </p>
          )}

          {activities.length === 0 ? (
            <EmptyState
              title="No activities yet"
              body="Clubs, sports, jobs, family responsibilities and personal projects all count. Start with the one that matters most to you."
              action={addButton}
            />
          ) : (
            <>
              <div className="mb-2 hidden items-center gap-3 sm:flex">
                <MicroLabel className="w-[72px]">No.</MicroLabel>
                <MicroLabel className="flex-1 pl-5">Activity</MicroLabel>
                <MicroLabel className="pr-2">Grades / time / hours</MicroLabel>
              </div>
              <ol className="stagger border-t border-portal-line-strong">
                {activities.map((a, i) => (
                  <ActivityRow
                    key={a.id}
                    activity={a}
                    index={i}
                    count={activities.length}
                    expanded={expandedId === a.id}
                    autoFocus={focusNewId === a.id}
                    maxImpact={maxImpact}
                    dragging={dragId === a.id}
                    dropEdge={
                      dragIndex >= 0 && overIndex === i && overIndex !== dragIndex
                        ? dragIndex < i
                          ? 'bottom'
                          : 'top'
                        : null
                    }
                    copyState={copyState}
                    onToggle={() => {
                      setFocusNewId(null);
                      setExpandedId((cur) => (cur === a.id ? null : a.id));
                    }}
                    onChange={(updates) => change(a.id, updates)}
                    onMove={(dir) => move(i, i + dir, dir < 0 ? 'up' : 'down')}
                    onDelete={() => {
                      setDeleteError(null);
                      setConfirmDelete(a);
                    }}
                    onCopy={() => void copy(a.id, activityText(a))}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', a.id);
                      setDragId(a.id);
                    }}
                    onDragOver={(e) => {
                      if (!dragId) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (overIndex !== i) setOverIndex(i);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIndex >= 0 && dragIndex !== i) move(dragIndex, i);
                      endDrag();
                    }}
                    onDragEnd={endDrag}
                  />
                ))}
              </ol>

              {/* The rest of the budget, drawn as empty numbered slots */}
              {!full && (
                <ol aria-label="Open slots" className="list-none">
                  {Array.from({ length: MAX_ACTIVITIES - activities.length }, (_, k) => {
                    const n = activities.length + k + 1;
                    return (
                      <li
                        key={n}
                        aria-hidden={k === 0 ? undefined : true}
                        className="flex h-10 items-stretch border-b border-dashed border-portal-line"
                      >
                        <span aria-hidden="true" className="flex w-14 flex-none items-center border-r border-dashed border-portal-line font-mono text-sm tabular-nums text-portal-dim/60 sm:w-[72px]">
                          {pad2(n)}
                        </span>
                        {k === 0 ? (
                          <button
                            type="button"
                            onClick={handleAdd}
                            disabled={adding}
                            className="flex flex-1 items-center gap-2 pl-4 font-mono text-[11px] uppercase tracking-[0.16em] text-portal-muted transition-colors hover:bg-portal-hover hover:text-portal-accent-light disabled:opacity-40 sm:pl-5"
                          >
                            <IconPlus size={12} />
                            {adding ? 'Adding...' : 'Add activity'}
                          </button>
                        ) : (
                          <span className="flex-1" aria-hidden="true" />
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}

              <p className="mt-6 hidden font-mono text-[11px] text-portal-dim sm:block">
                Drag a number to reorder, or use the arrows.
              </p>
            </>
          )}
        </>
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <p className="sr-only" role="status">
        {copyState ? (copyState.ok ? 'Copied to the clipboard.' : 'Copy failed. Select the text and copy it by hand.') : ''}
      </p>

      <Dialog
        open={confirmDelete !== null}
        onClose={closeDialog}
        title="Delete this activity?"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeDialog} disabled={deleting}>
              Keep it
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete activity'}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-portal-body">
          <span className="text-portal-text">{str(confirmDelete?.activity_name) || 'This activity'}</span> and its description will
          be removed from the list. The activities below it move up a slot. This cannot be undone.
        </p>
        {deleteError && (
          <p role="alert" className="mt-4 text-sm text-portal-red">
            {deleteError}
          </p>
        )}
      </Dialog>
    </Panel>
  );
}
