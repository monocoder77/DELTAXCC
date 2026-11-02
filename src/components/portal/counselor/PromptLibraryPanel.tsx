'use client';

/* ==========================================================================
   Counselor prompt library
   Every essay prompt across every student, grouped by school name (many
   students apply to the same school). Identical prompts collapse into one
   row that lists who uses it and how far each essay has come. Counselors can
   edit a prompt for everyone at once, delete it with a clear warning, copy it
   to classmates applying to the same school, or add a new one.
   ========================================================================== */

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { errorMessage, useApplications, useStudents } from '@/lib/hooks';
import type { Essay, EssayStatus, Profile, Prompt, School } from '@/types/database';
import type { CounselorPanelProps } from '../nav';
import {
  Avatar,
  Button,
  Checkbox,
  Dialog,
  Diamond,
  EmptyState,
  ESSAY_STATUS,
  Field,
  Input,
  LoadingBlock,
  Panel,
  PanelHeader,
  Stat,
  StatRow,
  StatusTag,
  Tag,
  Textarea,
  countWords,
  cx,
  pad2,
  toneColor,
} from '../ui/primitives';
import { IconChevronDown, IconEdit, IconLink, IconPlus, IconSearch, IconTrash } from '../ui/icons';

/* --------------------------------------------------------------------------
   Model
   -------------------------------------------------------------------------- */

const DEFAULT_WORD_LIMIT = 650;
const MAX_WORD_LIMIT = 10_000;
const CLAMP_CHARS = 220;
const GRID_ROWS = 6;
const GRID_COLS = 12;

/** One student's copy of a school (a school row). */
interface Placement {
  school: School;
  student?: Profile;
}

/** One prompt row as used by one student. */
interface PromptUse extends Placement {
  prompt: Prompt;
  essay?: Essay;
  status: EssayStatus;
  essayCount: number;
  commentCount: number;
  words: number;
}

/** Identical prompts (same normalized title and text) across students. */
interface DistinctPrompt {
  key: string;
  title: string;
  text: string;
  wordLimit: number;
  limitsVary: boolean;
  order: number;
  uses: PromptUse[];
  /** Students who have this school but not this prompt. */
  missing: Placement[];
}

interface SchoolGroup {
  key: string;
  name: string;
  isCommonApp: boolean;
  placements: Placement[];
  prompts: DistinctPrompt[];
}

type DialogState =
  /* Edit keeps a snapshot: saving changes the prompt's key, so a live lookup would unmount the dialog mid-save. */
  | { kind: 'edit'; groupKey: string; promptKey: string; schoolName: string; snapshot: DistinctPrompt }
  | { kind: 'delete' | 'copy'; groupKey: string; promptKey: string }
  | { kind: 'add'; groupKey: string }
  | null;

function norm(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function promptKey(p: Pick<Prompt, 'title' | 'prompt_text'>): string {
  return `${norm(p.title)}\u0000${norm(p.prompt_text)}`;
}

function studentName(student: Profile | undefined): string {
  return student?.full_name?.trim() || student?.email || 'Student';
}

function studentInitials(student: Profile | undefined): string {
  if (student?.avatar_initials) return student.avatar_initials;
  return studentName(student)
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function byStudentName(a: Placement, b: Placement): number {
  return studentName(a.student).localeCompare(studentName(b.student));
}

/** Most frequent value (ties go to the first seen). */
function mode<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  let best: T | undefined;
  let bestCount = 0;
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Distinct students behind a list of placements (one student can hold two rows for a school). */
function studentCountOf(list: Placement[]): number {
  return new Set(list.map((p) => p.school.student_id)).size;
}

function buildGroups(
  schools: School[],
  prompts: Prompt[],
  essays: Essay[],
  commentCounts: Map<string, number>,
  studentsById: Map<string, Profile>,
): SchoolGroup[] {
  const essaysByPrompt = new Map<string, Essay[]>();
  for (const e of essays) {
    const list = essaysByPrompt.get(e.prompt_id);
    if (list) list.push(e);
    else essaysByPrompt.set(e.prompt_id, [e]);
  }
  const promptsBySchool = new Map<string, Prompt[]>();
  for (const p of prompts) {
    const list = promptsBySchool.get(p.school_id);
    if (list) list.push(p);
    else promptsBySchool.set(p.school_id, [p]);
  }

  const bySchoolName = new Map<string, School[]>();
  for (const s of schools) {
    const key = norm(s.name);
    if (!key) continue;
    const list = bySchoolName.get(key);
    if (list) list.push(s);
    else bySchoolName.set(key, [s]);
  }

  const groups: SchoolGroup[] = [];
  for (const [key, rows] of bySchoolName) {
    const placements: Placement[] = rows
      .map((school) => ({ school, student: studentsById.get(school.student_id) }))
      .sort(byStudentName);
    const distinct = new Map<string, DistinctPrompt>();

    for (const placement of placements) {
      for (const prompt of promptsBySchool.get(placement.school.id) ?? []) {
        const pk = promptKey(prompt);
        const promptEssays = essaysByPrompt.get(prompt.id) ?? [];
        const essay = promptEssays.reduce<Essay | undefined>((best, e) => (!best || e.updated_at > best.updated_at ? e : best), undefined);
        const use: PromptUse = {
          ...placement,
          prompt,
          essay,
          status: essay?.status ?? 'not_started',
          essayCount: promptEssays.length,
          commentCount: promptEssays.reduce((n, e) => n + (commentCounts.get(e.id) ?? 0), 0),
          words: promptEssays.reduce((n, e) => n + (e.word_count || 0), 0),
        };
        const existing = distinct.get(pk);
        if (existing) {
          existing.uses.push(use);
          existing.order = Math.min(existing.order, prompt.sort_order);
        } else {
          distinct.set(pk, {
            key: pk,
            title: prompt.title.trim() || 'Untitled prompt',
            text: prompt.prompt_text.trim(),
            wordLimit: prompt.word_limit,
            limitsVary: false,
            order: prompt.sort_order,
            uses: [use],
            missing: [],
          });
        }
      }
    }

    const groupPrompts = [...distinct.values()].map((dp) => {
      const limits = dp.uses.map((u) => u.prompt.word_limit);
      const usedSchools = new Set(dp.uses.map((u) => u.school.id));
      return {
        ...dp,
        wordLimit: mode(limits) ?? dp.wordLimit,
        limitsVary: new Set(limits).size > 1,
        uses: [...dp.uses].sort(byStudentName),
        missing: placements.filter((pl) => !usedSchools.has(pl.school.id)),
      };
    });
    groupPrompts.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

    groups.push({
      key,
      name: mode(rows.map((s) => s.name.trim())) ?? rows[0].name,
      isCommonApp: rows.some((s) => Boolean(s.is_common_app)),
      placements,
      prompts: groupPrompts,
    });
  }

  return groups.sort((a, b) => {
    if (a.isCommonApp !== b.isCommonApp) return a.isCommonApp ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** Run a write for every item; report how many failed and why. */
async function runAll<T>(items: T[], fn: (item: T) => Promise<unknown>): Promise<{ failed: T[]; message: string | null }> {
  const results = await Promise.allSettled(items.map(fn));
  const failed: T[] = [];
  let first: unknown = null;
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      failed.push(items[i]);
      if (first === null) first = r.reason;
    }
  });
  if (failed.length === 0) return { failed, message: null };
  const prefix = items.length > 1 ? `${failed.length} of ${items.length} did not save. ` : '';
  return { failed, message: `${prefix}${errorMessage(first)}` };
}

function nextSortOrder(prompts: Prompt[], schoolId: string): number {
  return prompts.reduce((max, p) => (p.school_id === schoolId ? Math.max(max, p.sort_order) : max), 0) + 1;
}

/**
 * Pending flag plus a close handler with a stable identity that ignores
 * close requests (Escape, backdrop, X) while a write is in flight. Keeping the
 * identity stable stops Dialog from re-running its focus effect every render.
 */
function useBusyClose(onClose: () => void) {
  const [pending, setPendingState] = useState(false);
  const busy = useRef(false);
  const setPending = useCallback((value: boolean) => {
    busy.current = value;
    setPendingState(value);
  }, []);
  const close = useCallback(() => {
    if (!busy.current) onClose();
  }, [onClose]);
  return { pending, setPending, close };
}

function parseWordLimit(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n >= 1 && n <= MAX_WORD_LIMIT ? n : null;
}

/* --------------------------------------------------------------------------
   Panel
   -------------------------------------------------------------------------- */

export default function PromptLibraryPanel({ onOpenStudent }: CounselorPanelProps) {
  const { students, loading: studentsLoading, error: studentsError, reload: reloadStudents } = useStudents();
  const ids = useMemo(() => students.map((s) => s.id), [students]);
  const app = useApplications(ids);
  const { schools, prompts, essays, comments, addPrompt, updatePrompt, deletePrompt, reload: reloadApp } = app;

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const searchId = useId();

  const studentsById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const commentCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of comments) m.set(c.essay_id, (m.get(c.essay_id) ?? 0) + 1);
    return m;
  }, [comments]);

  const groups = useMemo(
    () => buildGroups(schools, prompts, essays, commentCounts, studentsById),
    [schools, prompts, essays, commentCounts, studentsById],
  );

  const q = norm(query);
  const visible = useMemo(() => {
    if (!q) return groups;
    const out: SchoolGroup[] = [];
    for (const g of groups) {
      if (g.key.includes(q)) {
        out.push(g);
        continue;
      }
      const matches = g.prompts.filter((p) => norm(p.title).includes(q) || norm(p.text).includes(q));
      if (matches.length) out.push({ ...g, prompts: matches });
    }
    return out;
  }, [groups, q]);

  const stats = useMemo(() => {
    const covered = new Set<string>();
    let distinct = 0;
    let gaps = 0;
    for (const g of groups) {
      distinct += g.prompts.length;
      for (const p of g.prompts) {
        gaps += p.missing.length;
        for (const u of p.uses) covered.add(u.school.student_id);
      }
    }
    return { schools: groups.length, distinct, covered: covered.size, gaps };
  }, [groups]);

  const toggle = useCallback((key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const retry = useCallback(() => {
    reloadStudents();
    reloadApp();
  }, [reloadStudents, reloadApp]);

  const closeDialog = useCallback(() => setDialog(null), []);

  const dialogGroup = dialog ? groups.find((g) => g.key === dialog.groupKey) : undefined;
  const dialogPrompt =
    dialog && (dialog.kind === 'delete' || dialog.kind === 'copy') ? dialogGroup?.prompts.find((p) => p.key === dialog.promptKey) : undefined;
  const dialogId = dialog ? `${dialog.kind}:${dialog.groupKey}:${dialog.kind === 'add' ? '' : dialog.promptKey}` : '';

  const allOpen = groups.length > 0 && groups.every((g) => open.has(g.key));

  if (studentsLoading || app.loading) {
    return (
      <Panel>
        <Header />
        <LoadingBlock label="Gathering prompts" />
      </Panel>
    );
  }

  const loadError = studentsError ?? app.error;

  return (
    <Panel>
      <Header
        actions={
          groups.length > 0 && !q ? (
            <Button variant="ghost" size="sm" onClick={() => setOpen(allOpen ? new Set() : new Set(groups.map((g) => g.key)))}>
              {allOpen ? 'Collapse all' : 'Expand all'}
            </Button>
          ) : null
        }
      />

      {loadError && (
        <div role="alert" className="mb-8 flex flex-wrap items-center justify-between gap-3 border-y border-portal-red/40 py-3 text-sm text-portal-red">
          <span>Could not load the prompt library. {loadError}</span>
          <Button variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {!loadError && students.length === 0 ? (
        <EmptyState title="No students yet" body="Once students join, the prompts for the schools on their lists show up here." />
      ) : !loadError && groups.length === 0 ? (
        <EmptyState
          title="No schools on any list yet"
          body="When you or your students add schools, their essay prompts gather here, grouped by school."
        />
      ) : groups.length > 0 ? (
        <>
          <StatRow className="animate-rise mb-10">
            <Stat value={pad2(stats.schools)} label="Schools" />
            <Stat value={pad2(stats.distinct)} label="Distinct prompts" tone="accent" />
            <Stat value={pad2(stats.covered)} label="Students covered" sub={`of ${plural(students.length, 'student')}`} />
            <Stat
              value={pad2(stats.gaps)}
              label="Open gaps"
              tone={stats.gaps > 0 ? 'amber' : 'green'}
              sub={stats.gaps > 0 ? 'Classmates missing a prompt' : 'Every classmate is covered'}
            />
          </StatRow>

          <div className="relative mb-8 max-w-md">
            <label htmlFor={searchId} className="sr-only">
              Search schools and prompts
            </label>
            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-portal-dim" />
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search schools and prompt text"
              className="pl-9"
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState
              title="Nothing matches that search"
              body={`No school name or prompt contains "${query.trim()}".`}
              action={
                <Button variant="outline" size="sm" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <div className="border-t border-portal-line-strong">
              {visible.map((g, i) => (
                <SchoolSection
                  key={g.key}
                  index={i + 1}
                  group={g}
                  open={Boolean(q) || open.has(g.key)}
                  forcedOpen={Boolean(q)}
                  onToggle={() => toggle(g.key)}
                  onAdd={() => setDialog({ kind: 'add', groupKey: g.key })}
                  onEdit={(pk) => {
                    const snapshot = g.prompts.find((p) => p.key === pk);
                    if (snapshot) setDialog({ kind: 'edit', groupKey: g.key, promptKey: pk, schoolName: g.name, snapshot });
                  }}
                  onDelete={(pk) => setDialog({ kind: 'delete', groupKey: g.key, promptKey: pk })}
                  onCopy={(pk) => setDialog({ kind: 'copy', groupKey: g.key, promptKey: pk })}
                  onOpenStudent={onOpenStudent}
                />
              ))}
            </div>
          )}
        </>
      ) : null}

      {dialog?.kind === 'edit' && (
        <EditPromptDialog
          key={dialogId}
          prompt={dialog.snapshot}
          schoolName={dialog.schoolName}
          onClose={closeDialog}
          updatePrompt={updatePrompt}
          reload={reloadApp}
        />
      )}
      {dialog?.kind === 'delete' && dialogPrompt && (
        <DeletePromptDialog key={dialogId} prompt={dialogPrompt} schoolName={dialogGroup?.name ?? ''} onClose={closeDialog} deletePrompt={deletePrompt} reload={reloadApp} />
      )}
      {dialog?.kind === 'copy' && dialogPrompt && (
        <CopyPromptDialog
          key={dialogId}
          prompt={dialogPrompt}
          schoolName={dialogGroup?.name ?? ''}
          allPrompts={prompts}
          onClose={closeDialog}
          addPrompt={addPrompt}
        />
      )}
      {dialog?.kind === 'add' && dialogGroup && (
        <AddPromptDialog key={dialogId} group={dialogGroup} allPrompts={prompts} onClose={closeDialog} addPrompt={addPrompt} />
      )}
    </Panel>
  );
}

function Header({ actions }: { actions?: ReactNode }) {
  return (
    <PanelHeader
      index="06"
      eyebrow="Library"
      title="Prompt Library"
      description="Every essay prompt across your students, gathered by school. Edit once for everyone, and copy prompts to classmates applying to the same place."
      actions={actions}
    />
  );
}

/* --------------------------------------------------------------------------
   School section
   -------------------------------------------------------------------------- */

function SchoolSection({
  index,
  group,
  open,
  forcedOpen,
  onToggle,
  onAdd,
  onEdit,
  onDelete,
  onCopy,
  onOpenStudent,
}: {
  index: number;
  group: SchoolGroup;
  open: boolean;
  forcedOpen: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onEdit: (promptKey: string) => void;
  onDelete: (promptKey: string) => void;
  onCopy: (promptKey: string) => void;
  onOpenStudent: CounselorPanelProps['onOpenStudent'];
}) {
  const bodyId = useId();
  const gaps = group.prompts.reduce((n, p) => n + p.missing.length, 0);
  const studentCount = studentCountOf(group.placements);

  return (
    <section className="border-b border-portal-line">
      <div className="flex items-center gap-3 py-4 sm:gap-5">
        <button
          type="button"
          onClick={onToggle}
          disabled={forcedOpen}
          aria-expanded={open}
          aria-controls={bodyId}
          className="group flex min-h-10 min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default sm:gap-5"
        >
          <span className="w-6 flex-none font-mono text-[11px] tabular-nums text-portal-dim">{pad2(index)}</span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="truncate font-serif text-lg font-bold text-portal-text transition-colors group-hover:text-portal-accent-light">
                {group.name}
              </span>
              {group.isCommonApp && <Tag tone="accent">Common App</Tag>}
            </span>
            <span className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10px] uppercase tracking-[0.14em] text-portal-muted">
              <span>{plural(group.prompts.length, 'prompt')}</span>
              <span>{plural(studentCount, 'student')}</span>
              {gaps > 0 && <span className="text-portal-amber">{plural(gaps, 'gap')}</span>}
            </span>
          </span>
          <CoverageGrid group={group} />
          {!forcedOpen && (
            <IconChevronDown
              size={16}
              className={cx('flex-none text-portal-dim transition-transform duration-200 ease-portal', open && 'rotate-180')}
            />
          )}
        </button>
        <Button variant="ghost" size="sm" onClick={onAdd} aria-label={`Add a prompt to ${group.name}`} className="flex-none">
          <IconPlus size={14} />
          <span className="hidden sm:inline">Add prompt</span>
        </Button>
      </div>

      {open && (
        <div id={bodyId} className="animate-rise pb-6 sm:pl-11">
          {group.prompts.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-portal-line-strong py-5 text-sm text-portal-muted">
              <span>No prompts for {group.name} yet.</span>
              <Button variant="outline" size="sm" onClick={onAdd}>
                <IconPlus size={14} />
                Add the first prompt
              </Button>
            </div>
          ) : (
            <ol className="stagger">
              {group.prompts.map((p, i) => (
                <PromptRow
                  key={p.key}
                  index={i + 1}
                  prompt={p}
                  onEdit={() => onEdit(p.key)}
                  onDelete={() => onDelete(p.key)}
                  onCopy={() => onCopy(p.key)}
                  onOpenStudent={onOpenStudent}
                />
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Signature: a tiny matrix, one row per prompt and one column per student.
 * Filled squares take the essay's status color; hollow squares are gaps.
 */
function CoverageGrid({ group }: { group: SchoolGroup }) {
  if (group.prompts.length === 0 || group.placements.length < 2) return null;
  const rows = group.prompts.slice(0, GRID_ROWS);
  const cols = group.placements.slice(0, GRID_COLS);
  return (
    <span aria-hidden="true" className="hidden flex-none flex-col gap-[3px] md:flex">
      {rows.map((p) => {
        const bySchool = new Map(p.uses.map((u) => [u.school.id, u]));
        return (
          <span key={p.key} className="flex gap-[3px]">
            {cols.map((pl) => {
              const use = bySchool.get(pl.school.id);
              if (!use) return <span key={pl.school.id} className="h-[7px] w-[7px] border border-dashed border-portal-dim" />;
              const color = toneColor[ESSAY_STATUS[use.status].tone];
              return (
                <span
                  key={pl.school.id}
                  className="h-[7px] w-[7px]"
                  style={{ background: use.status === 'not_started' ? 'transparent' : color, border: `1px solid ${color}` }}
                />
              );
            })}
          </span>
        );
      })}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Prompt row
   -------------------------------------------------------------------------- */

function PromptRow({
  index,
  prompt,
  onEdit,
  onDelete,
  onCopy,
  onOpenStudent,
}: {
  index: number;
  prompt: DistinctPrompt;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onOpenStudent: CounselorPanelProps['onOpenStudent'];
}) {
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  const long = prompt.text.length > CLAMP_CHARS;

  return (
    <li className="grid gap-5 border-t border-portal-line py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] lg:gap-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-[10px] text-portal-dim">{pad2(index)}</span>
          <h3 className="font-serif text-base font-bold text-portal-text">{prompt.title}</h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-portal-muted">
            {prompt.wordLimit} words{prompt.limitsVary ? ' (varies)' : ''}
          </span>
        </div>
        {prompt.text ? (
          <>
            <p id={textId} className={cx('mt-2 font-serif text-[15px] leading-relaxed text-portal-body', long && !expanded && 'line-clamp-3')}>
              {prompt.text}
            </p>
            {long && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                aria-controls={textId}
                className="mt-1 min-h-8 font-mono text-[10px] uppercase tracking-[0.14em] text-portal-accent-light hover:text-portal-text"
              >
                {expanded ? 'Show less' : 'Read full prompt'}
              </button>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm italic text-portal-dim">No prompt text yet.</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <IconEdit size={14} />
            Edit
          </Button>
          {prompt.missing.length > 0 && (
            <Button variant="ghost" size="sm" onClick={onCopy} className="text-portal-accent-light">
              <IconLink size={14} />
              Copy to {plural(studentCountOf(prompt.missing), 'student')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDelete} className="hover:text-portal-red">
            <IconTrash size={14} />
            Delete
          </Button>
        </div>
      </div>

      <div className="min-w-0 lg:border-l lg:border-portal-line lg:pl-6">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">Used by {prompt.uses.length}</p>
        <ul className="divide-y divide-portal-line">
          {prompt.uses.map((u) => (
            <li key={u.prompt.id}>
              <button
                type="button"
                onClick={() => onOpenStudent(u.school.student_id, 'schools', { schoolId: u.school.id, promptId: u.prompt.id })}
                className="group flex min-h-9 w-full items-center gap-3 py-1.5 text-left"
                aria-label={`Open ${studentName(u.student)}'s ${u.school.name} essay (${ESSAY_STATUS[u.status].label})`}
              >
                <Avatar initials={studentInitials(u.student)} size={22} />
                <span className="min-w-0 flex-1 truncate text-sm text-portal-body transition-colors group-hover:text-portal-text">
                  {studentName(u.student)}
                </span>
                <StatusTag status={u.status} />
              </button>
            </li>
          ))}
        </ul>
        {prompt.missing.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-portal-line-strong pt-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-portal-amber">Missing</span>
            {prompt.missing.map((m) => (
              <span key={m.school.id} className="inline-flex items-center gap-1.5 text-xs text-portal-muted">
                <Diamond size={5} filled={false} color={toneColor.amber} />
                {studentName(m.student)}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

/* --------------------------------------------------------------------------
   Shared dialog pieces
   -------------------------------------------------------------------------- */

interface Target {
  id: string;
  student?: Profile;
  sub?: string;
}

function TargetChecklist({
  label,
  targets,
  selected,
  onChange,
  disabled,
}: {
  label: string;
  targets: Target[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  const allOn = targets.length > 0 && targets.every((t) => selected.has(t.id));
  return (
    <fieldset disabled={disabled} className="relative min-w-0">
      <legend className="mb-1 flex min-h-8 w-full items-center pr-24 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">{label}</legend>
      {targets.length > 1 && (
        <button
          type="button"
          onClick={() => onChange(allOn ? new Set() : new Set(targets.map((t) => t.id)))}
          className="absolute right-0 top-0 min-h-8 font-mono text-[10px] uppercase tracking-[0.14em] text-portal-accent-light hover:text-portal-text"
        >
          {allOn ? 'Clear' : 'Select all'}
        </button>
      )}
      <ul className="max-h-60 divide-y divide-portal-line overflow-y-auto border-y border-portal-line">
        {targets.map((t) => {
          const name = studentName(t.student);
          return (
            <li key={t.id}>
              <label className="flex min-h-10 cursor-pointer items-center gap-3 py-1.5">
                <Checkbox
                  checked={selected.has(t.id)}
                  label={name}
                  onChange={(on) => {
                    const next = new Set(selected);
                    if (on) next.add(t.id);
                    else next.delete(t.id);
                    onChange(next);
                  }}
                />
                <Avatar initials={studentInitials(t.student)} size={22} />
                <span className="min-w-0 flex-1 truncate text-sm text-portal-text">{name}</span>
                {t.sub && <span className="flex-none text-xs text-portal-dim">{t.sub}</span>}
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

function DialogError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-4 border-l-2 border-portal-red pl-3 text-sm text-portal-red">
      {message}
    </p>
  );
}

function PromptFields({
  title,
  text,
  limit,
  onTitle,
  onText,
  onLimit,
  limitError,
  limitHint,
  disabled,
}: {
  title: string;
  text: string;
  limit: string;
  onTitle: (v: string) => void;
  onText: (v: string) => void;
  onLimit: (v: string) => void;
  limitError?: string;
  limitHint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid gap-4">
      <Field label="Title" htmlFor={`${id}-title`}>
        <Input id={`${id}-title`} value={title} onChange={(e) => onTitle(e.target.value)} disabled={disabled} maxLength={200} required />
      </Field>
      <Field label="Prompt text" htmlFor={`${id}-text`} counter={`${countWords(text)} words`}>
        <Textarea id={`${id}-text`} value={text} onChange={(e) => onText(e.target.value)} disabled={disabled} rows={5} className="font-serif" />
      </Field>
      <Field label="Word limit" htmlFor={`${id}-limit`} error={limitError} hint={limitHint}>
        <Input
          id={`${id}-limit`}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_WORD_LIMIT}
          value={limit}
          onChange={(e) => onLimit(e.target.value)}
          disabled={disabled}
          className="max-w-[140px] font-mono"
        />
      </Field>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Edit
   -------------------------------------------------------------------------- */

function EditPromptDialog({
  prompt,
  schoolName,
  onClose,
  updatePrompt,
  reload,
}: {
  prompt: DistinctPrompt;
  schoolName: string;
  onClose: () => void;
  updatePrompt: ReturnType<typeof useApplications>['updatePrompt'];
  reload: () => void;
}) {
  const [initial] = useState(() => ({ title: prompt.title, text: prompt.text, limit: String(prompt.wordLimit) }));
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(initial.text);
  const [limit, setLimit] = useState(initial.limit);
  const [applyAll, setApplyAll] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(prompt.uses[0] ? [prompt.uses[0].prompt.id] : []));
  const { pending, setPending, close } = useBusyClose(onClose);
  const [error, setError] = useState<string | null>(null);

  const studentCount = studentCountOf(prompt.uses);
  const parsedLimit = parseWordLimit(limit);
  const titleDirty = title.trim() !== initial.title;
  const textDirty = text.trim() !== initial.text;
  const limitDirty = limit.trim() !== initial.limit;
  const dirty = titleDirty || textDirty || limitDirty;
  const targets = applyAll ? prompt.uses : prompt.uses.filter((u) => picked.has(u.prompt.id));
  const targetStudents = studentCountOf(targets);
  const valid = title.trim().length > 0 && (!limitDirty || parsedLimit !== null);
  const canSave = dirty && valid && targets.length > 0 && !pending;

  const save = async () => {
    if (!canSave) return;
    const updates: { title?: string; prompt_text?: string; word_limit?: number } = {};
    if (titleDirty) updates.title = title.trim();
    if (textDirty) updates.prompt_text = text.trim();
    if (limitDirty && parsedLimit !== null) updates.word_limit = parsedLimit;
    setPending(true);
    setError(null);
    const { message } = await runAll(targets, (u) => updatePrompt(u.prompt.id, updates));
    setPending(false);
    if (message) {
      setError(message);
      reload();
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open
      onClose={close}
      title={`Edit prompt · ${schoolName}`}
      width={600}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            {pending ? 'Saving' : targetStudents > 1 ? `Save for ${plural(targetStudents, 'student')}` : 'Save'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <PromptFields
          title={title}
          text={text}
          limit={limit}
          onTitle={setTitle}
          onText={setText}
          onLimit={setLimit}
          disabled={pending}
          limitError={limitDirty && parsedLimit === null ? `Enter a whole number from 1 to ${MAX_WORD_LIMIT}.` : undefined}
          limitHint={prompt.limitsVary && !limitDirty ? 'Limits differ between students. Change this to set one limit for all.' : undefined}
        />
        {prompt.uses.length > 1 && (
          <div className="mt-5 border-t border-portal-line pt-4">
            <label className="flex min-h-8 cursor-pointer items-center gap-3 text-sm text-portal-text">
              <Checkbox checked={applyAll} onChange={setApplyAll} label={`Apply to all ${studentCount} students with this prompt`} />
              Apply to all {studentCount} students with this prompt
            </label>
            {!applyAll && (
              <div className="mt-4">
                <TargetChecklist
                  label="Only update for"
                  targets={prompt.uses.map((u) => ({ id: u.prompt.id, student: u.student, sub: u.school.program || undefined }))}
                  selected={picked}
                  onChange={setPicked}
                  disabled={pending}
                />
                <p className="mt-2 text-xs text-portal-dim">The others keep the current wording, so this prompt will split into two in the library.</p>
              </div>
            )}
          </div>
        )}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
      <DialogError message={error} />
    </Dialog>
  );
}

/* --------------------------------------------------------------------------
   Delete
   -------------------------------------------------------------------------- */

function DeletePromptDialog({
  prompt,
  schoolName,
  onClose,
  deletePrompt,
  reload,
}: {
  prompt: DistinctPrompt;
  schoolName: string;
  onClose: () => void;
  deletePrompt: (id: string) => Promise<void>;
  reload: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(prompt.uses.map((u) => u.prompt.id)));
  const { pending, setPending, close } = useBusyClose(onClose);
  const [error, setError] = useState<string | null>(null);

  // Only rows that still exist (after a partial failure, deleted ones drop out).
  const targets = prompt.uses.filter((u) => picked.has(u.prompt.id));
  const essays = targets.reduce((n, u) => n + u.essayCount, 0);
  const words = targets.reduce((n, u) => n + u.words, 0);
  const commentTotal = targets.reduce((n, u) => n + u.commentCount, 0);
  const everyone = targets.length === prompt.uses.length;
  const targetStudents = studentCountOf(targets);

  const confirm = async () => {
    if (targets.length === 0 || pending) return;
    setPending(true);
    setError(null);
    const { message } = await runAll(targets, (u) => deletePrompt(u.prompt.id));
    setPending(false);
    if (message) {
      setError(message);
      reload();
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open
      onClose={close}
      title="Delete prompt"
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={pending || targets.length === 0}>
            <IconTrash size={14} />
            {pending ? 'Deleting' : everyone && targetStudents > 1 ? `Delete for all ${targetStudents}` : `Delete for ${plural(targetStudents, 'student')}`}
          </Button>
        </>
      }
    >
      <p className="text-sm text-portal-body">
        <span className="font-serif font-bold text-portal-text">{prompt.title}</span> at {schoolName}
      </p>

      {prompt.uses.length > 1 ? (
        <div className="mt-5">
          <TargetChecklist
            label="Delete for"
            targets={prompt.uses.map((u) => ({
              id: u.prompt.id,
              student: u.student,
              sub: u.essayCount > 0 ? `${u.words} words, ${ESSAY_STATUS[u.status].label.toLowerCase()}` : 'No essay yet',
            }))}
            selected={picked}
            onChange={setPicked}
            disabled={pending}
          />
        </div>
      ) : null}

      <div role="note" className="mt-5 flex gap-3 border-l-2 border-portal-red py-1 pl-4">
        <Diamond size={8} color={toneColor.red} className="mt-1.5" />
        <p className="text-sm leading-relaxed text-portal-body">
          This permanently deletes the prompt for{' '}
          <strong className="text-portal-text">{targets.length === 1 ? studentName(targets[0].student) : plural(targetStudents, 'student')}</strong>
          {essays > 0 ? (
            <>
              , along with{' '}
              <strong className="text-portal-red">
                {plural(essays, 'essay')}
                {words > 0 ? ` (${words.toLocaleString('en-US')} words written)` : ''}
              </strong>{' '}
              and <strong className="text-portal-red">{plural(commentTotal, 'comment')}</strong>
            </>
          ) : (
            ' (no essays have been started for it)'
          )}
          . This cannot be undone.
        </p>
      </div>
      <DialogError message={error} />
    </Dialog>
  );
}

/* --------------------------------------------------------------------------
   Copy to students (signature)
   -------------------------------------------------------------------------- */

function CopyPromptDialog({
  prompt,
  schoolName,
  allPrompts,
  onClose,
  addPrompt,
}: {
  prompt: DistinctPrompt;
  schoolName: string;
  allPrompts: Prompt[];
  onClose: () => void;
  addPrompt: ReturnType<typeof useApplications>['addPrompt'];
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(prompt.missing.map((m) => m.school.id)));
  const { pending, setPending, close } = useBusyClose(onClose);
  const [error, setError] = useState<string | null>(null);

  // Live list: students who received it already drop out after a partial failure.
  const targets = prompt.missing.filter((m) => picked.has(m.school.id));
  const source = prompt.uses[0]?.prompt;

  const copy = async () => {
    if (!source || targets.length === 0 || pending) return;
    setPending(true);
    setError(null);
    const { message } = await runAll(targets, (m) =>
      addPrompt({
        school_id: m.school.id,
        title: source.title,
        prompt_text: source.prompt_text,
        word_limit: prompt.wordLimit,
        sort_order: nextSortOrder(allPrompts, m.school.id),
      }),
    );
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open
      onClose={close}
      title="Copy to students"
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={copy} disabled={pending || targets.length === 0 || !source}>
            <IconLink size={14} />
            {pending ? 'Copying' : `Copy to ${plural(studentCountOf(targets), 'student')}`}
          </Button>
        </>
      }
    >
      <div className="border-l-2 border-portal-accent pl-4">
        <p className="font-serif text-base font-bold text-portal-text">{prompt.title}</p>
        <p className="mt-1 line-clamp-3 font-serif text-sm leading-relaxed text-portal-body">{prompt.text || 'No prompt text.'}</p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-portal-muted">{prompt.wordLimit} words</p>
      </div>
      <p className="mt-5 text-sm text-portal-body">
        These students also have {schoolName} on their list but not this prompt. It is added to the end of their prompts for that school.
      </p>
      <div className="mt-4">
        <TargetChecklist
          label="Add for"
          targets={prompt.missing.map((m) => ({ id: m.school.id, student: m.student, sub: m.school.program || undefined }))}
          selected={picked}
          onChange={setPicked}
          disabled={pending}
        />
      </div>
      <DialogError message={error} />
    </Dialog>
  );
}

/* --------------------------------------------------------------------------
   Add prompt to a school group
   -------------------------------------------------------------------------- */

function AddPromptDialog({
  group,
  allPrompts,
  onClose,
  addPrompt,
}: {
  group: SchoolGroup;
  allPrompts: Prompt[];
  onClose: () => void;
  addPrompt: ReturnType<typeof useApplications>['addPrompt'];
}) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [limit, setLimit] = useState(String(DEFAULT_WORD_LIMIT));
  const [picked, setPicked] = useState<Set<string>>(() => new Set(group.placements.map((p) => p.school.id)));
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const { pending, setPending, close } = useBusyClose(onClose);
  const [error, setError] = useState<string | null>(null);

  const parsedLimit = parseWordLimit(limit);
  // Schools that already received it (after a partial failure) are skipped on retry.
  const targets = group.placements.filter((p) => picked.has(p.school.id) && !done.has(p.school.id));
  const canSave = title.trim().length > 0 && text.trim().length > 0 && parsedLimit !== null && targets.length > 0 && !pending;

  const save = async () => {
    if (!canSave || parsedLimit === null) return;
    setPending(true);
    setError(null);
    const { failed, message } = await runAll(targets, (p) =>
      addPrompt({
        school_id: p.school.id,
        title: title.trim(),
        prompt_text: text.trim(),
        word_limit: parsedLimit,
        sort_order: nextSortOrder(allPrompts, p.school.id),
      }),
    );
    setPending(false);
    if (message) {
      const failedIds = new Set(failed.map((p) => p.school.id));
      setDone((prev) => new Set([...prev, ...targets.filter((t) => !failedIds.has(t.school.id)).map((t) => t.school.id)]));
      setError(message);
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open
      onClose={close}
      title={`Add prompt · ${group.name}`}
      width={600}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!canSave}>
            <IconPlus size={14} />
            {pending ? 'Adding' : `Add for ${plural(studentCountOf(targets), 'student')}`}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <PromptFields
          title={title}
          text={text}
          limit={limit}
          onTitle={setTitle}
          onText={setText}
          onLimit={setLimit}
          disabled={pending}
          limitError={limit.trim() && parsedLimit === null ? `Enter a whole number from 1 to ${MAX_WORD_LIMIT}.` : undefined}
        />
        <div className="mt-5">
          <TargetChecklist
            label={`Add to ${group.name} for`}
            targets={group.placements
              .filter((p) => !done.has(p.school.id))
              .map((p) => ({ id: p.school.id, student: p.student, sub: p.school.program || undefined }))}
            selected={picked}
            onChange={setPicked}
            disabled={pending}
          />
          {done.size > 0 && <p className="mt-2 text-xs text-portal-green">Already added for {plural(done.size, 'student')}.</p>}
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
      <DialogError message={error} />
    </Dialog>
  );
}
