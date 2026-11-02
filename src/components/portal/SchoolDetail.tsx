'use client';

/* ==========================================================================
   School detail: header, deadline countdown, and the numbered list of essay
   prompts. Opening a prompt reveals its full text and the essay editor.
   Also exports the add/edit school dialog shared with SchoolsPanel.
   ========================================================================== */

import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { errorMessage, useNow } from '@/lib/hooks';
import type { ApplicationsApi, SchoolWithEssays } from '@/lib/hooks';
import type { NewSchool } from '@/lib/backend/types';
import type { EssayStatus, PromptWithEssay, SchoolCategory } from '@/types/database';
import type { Viewer } from './nav';
import EssayEditor from './EssayEditor';
import {
  Button,
  CategoryTag,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  LineMeter,
  Panel,
  PanelHeader,
  SectionLabel,
  SegmentBar,
  Select,
  Stat,
  StatRow,
  StatusTag,
  Tag,
  Textarea,
  cx,
  daysUntil,
  formatDate,
  pad2,
  relativeDays,
} from './ui/primitives';
import { IconArrowLeft, IconChevronDown, IconEdit, IconPlus, IconTrash } from './ui/icons';

/* --------------------------------------------------------------------------
   Shared helpers
   -------------------------------------------------------------------------- */

export const DECISION_PLANS = ['ED', 'ED II', 'EA', 'REA', 'RD', 'Rolling'] as const;

const DONE_STATUSES: EssayStatus[] = ['final', 'submitted'];

export function essayStatusOf(prompt: PromptWithEssay): EssayStatus {
  return prompt.essay?.status ?? 'not_started';
}

export function isEssayDone(prompt: PromptWithEssay): boolean {
  return DONE_STATUSES.includes(essayStatusOf(prompt));
}

/** Past the deadline with essay work still open. Undated schools are never overdue. */
export function isSchoolOverdue(school: SchoolWithEssays, now: Date): boolean {
  const days = daysUntil(school.deadline, now);
  if (days === null || days >= 0) return false;
  return !school.prompts.every(isEssayDone);
}

/* --------------------------------------------------------------------------
   School form dialog (add + edit)
   -------------------------------------------------------------------------- */

type PlanChoice = '' | (typeof DECISION_PLANS)[number] | 'Other';

function splitPlan(plan: string): { choice: PlanChoice; other: string } {
  const value = plan.trim();
  if (!value) return { choice: '', other: '' };
  const known = DECISION_PLANS.find((p) => p.toLowerCase() === value.toLowerCase());
  return known ? { choice: known, other: '' } : { choice: 'Other', other: value };
}

/**
 * Add or edit a school. Render it only while open (`{open && <SchoolFormDialog />}`)
 * so the form starts fresh each time.
 */
export function SchoolFormDialog({
  title,
  submitLabel,
  initial,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initial?: Partial<NewSchool>;
  onSubmit: (values: NewSchool) => Promise<unknown>;
  onClose: () => void;
}) {
  const uid = useId();
  const formId = `${uid}-form`;
  const startPlan = splitPlan(initial?.decision_plan ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [program, setProgram] = useState(initial?.program ?? '');
  const [category, setCategory] = useState<SchoolCategory>(initial?.category ?? 'target');
  const [planChoice, setPlanChoice] = useState<PlanChoice>(startPlan.choice);
  const [planOther, setPlanOther] = useState(startPlan.other);
  const [deadline, setDeadline] = useState(initial?.deadline ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [isCommonApp, setIsCommonApp] = useState(Boolean(initial?.is_common_app));
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    if (!pending) onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give the school a name.');
      return;
    }
    setNameError(null);
    setError(null);
    setPending(true);
    try {
      await onSubmit({
        name: trimmed,
        program: program.trim(),
        category,
        decision_plan: planChoice === 'Other' ? planOther.trim() : planChoice,
        deadline,
        notes: notes.trim(),
        is_common_app: isCommonApp,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  };

  return (
    <Dialog
      open
      onClose={close}
      title={title}
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={pending}>
            {pending ? 'Saving' : submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-2">
        <Field label="School name" htmlFor={`${uid}-name`} error={nameError} className="sm:col-span-2">
          <Input
            id={`${uid}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rice University"
            required
            aria-invalid={Boolean(nameError)}
            maxLength={200}
          />
        </Field>
        <Field label="Program or school" htmlFor={`${uid}-program`} className="sm:col-span-2">
          <Input
            id={`${uid}-program`}
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            placeholder="e.g. School of Engineering"
            maxLength={200}
          />
        </Field>
        <Field label="Category" htmlFor={`${uid}-category`}>
          <Select id={`${uid}-category`} value={category} onChange={(e) => setCategory(e.target.value as SchoolCategory)}>
            <option value="reach">Reach</option>
            <option value="target">Target</option>
            <option value="safety">Safety</option>
          </Select>
        </Field>
        <Field label="Decision plan" htmlFor={`${uid}-plan`}>
          <Select id={`${uid}-plan`} value={planChoice} onChange={(e) => setPlanChoice(e.target.value as PlanChoice)}>
            <option value="">Not set</option>
            {DECISION_PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value="Other">Other</option>
          </Select>
        </Field>
        {planChoice === 'Other' && (
          <Field label="Plan name" htmlFor={`${uid}-plan-other`} className="sm:col-span-2">
            <Input
              id={`${uid}-plan-other`}
              value={planOther}
              onChange={(e) => setPlanOther(e.target.value)}
              placeholder="e.g. Priority, UC deadline"
              maxLength={40}
            />
          </Field>
        )}
        <Field label="Deadline" htmlFor={`${uid}-deadline`} hint="Leave empty if there is no date yet.">
          <Input id={`${uid}-deadline`} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>
        <div className="flex items-center sm:pt-5">
          <label className="flex min-h-8 cursor-pointer items-center gap-3 text-sm text-portal-body">
            <Checkbox checked={isCommonApp} onChange={setIsCommonApp} label="This is the Common App" />
            This is the Common App
          </label>
        </div>
        <Field label="Notes" htmlFor={`${uid}-notes`} className="sm:col-span-2">
          <Textarea
            id={`${uid}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Supplements, portals, anything worth remembering"
            rows={3}
          />
        </Field>
        {error && (
          <p role="alert" className="border-l-2 border-portal-red pl-3 text-sm text-portal-red sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

/* --------------------------------------------------------------------------
   Confirm dialog
   -------------------------------------------------------------------------- */

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  /** The caller closes the dialog (or unmounts it) once this resolves. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (!pending) onClose();
  };

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  };

  return (
    <Dialog
      open
      onClose={close}
      title={title}
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={pending}>
            {pending ? 'Deleting' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-portal-body">{body}</div>
      {error && (
        <p role="alert" className="mt-4 border-l-2 border-portal-red pl-3 text-sm text-portal-red">
          {error}
        </p>
      )}
    </Dialog>
  );
}

/* --------------------------------------------------------------------------
   Prompt form dialog (counselors)
   -------------------------------------------------------------------------- */

interface PromptValues {
  title: string;
  prompt_text: string;
  word_limit: number;
}

function PromptFormDialog({
  title,
  submitLabel,
  initial,
  onSubmit,
  onClose,
}: {
  title: string;
  submitLabel: string;
  initial?: PromptValues;
  onSubmit: (values: PromptValues) => Promise<unknown>;
  onClose: () => void;
}) {
  const uid = useId();
  const formId = `${uid}-form`;
  const [promptTitle, setPromptTitle] = useState(initial?.title ?? '');
  const [text, setText] = useState(initial?.prompt_text ?? '');
  const [limit, setLimit] = useState(String(initial?.word_limit ?? 650));
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; limit?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    if (!pending) onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = promptTitle.trim();
    const words = Number(limit);
    const errs: { title?: string; limit?: string } = {};
    if (!trimmed) errs.title = 'Give the prompt a short title.';
    if (!Number.isInteger(words) || words < 1 || words > 10000) errs.limit = 'Enter a whole number between 1 and 10000.';
    setFieldErrors(errs);
    if (errs.title || errs.limit) return;
    setError(null);
    setPending(true);
    try {
      await onSubmit({ title: trimmed, prompt_text: text.trim(), word_limit: words });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  };

  return (
    <Dialog
      open
      onClose={close}
      title={title}
      width={600}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={pending}>
            {pending ? 'Saving' : submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="grid gap-5 sm:grid-cols-[1fr_140px]">
        <Field label="Title" htmlFor={`${uid}-title`} error={fieldErrors.title}>
          <Input
            id={`${uid}-title`}
            value={promptTitle}
            onChange={(e) => setPromptTitle(e.target.value)}
            placeholder="e.g. Why this school"
            aria-invalid={Boolean(fieldErrors.title)}
            maxLength={200}
          />
        </Field>
        <Field label="Word limit" htmlFor={`${uid}-limit`} error={fieldErrors.limit}>
          <Input
            id={`${uid}-limit`}
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            step={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            aria-invalid={Boolean(fieldErrors.limit)}
            className="font-mono"
          />
        </Field>
        <Field label="Prompt text" htmlFor={`${uid}-text`} className="sm:col-span-2">
          <Textarea
            id={`${uid}-text`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the full prompt as the school wrote it"
            rows={6}
          />
        </Field>
        {error && (
          <p role="alert" className="border-l-2 border-portal-red pl-3 text-sm text-portal-red sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

/* --------------------------------------------------------------------------
   Header pieces
   -------------------------------------------------------------------------- */

function DeadlineStat({ school, now }: { school: SchoolWithEssays; now: Date }) {
  const days = daysUntil(school.deadline, now);
  if (days === null) return <Stat value="--" label="No deadline set" />;
  const overdue = isSchoolOverdue(school, now);
  const tone = overdue ? 'red' : days <= 7 && days >= 0 ? 'amber' : 'neutral';
  const value = days < 0 ? `+${Math.abs(days)}` : pad2(days);
  const label = days < 0 ? 'Days past deadline' : days === 1 ? 'Day left' : 'Days left';
  return (
    <Stat
      value={value}
      tone={tone}
      label={label}
      sub={formatDate(school.deadline, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
    />
  );
}

/* --------------------------------------------------------------------------
   Prompt row
   -------------------------------------------------------------------------- */

function PromptSection({
  prompt,
  index,
  open,
  onToggle,
  school,
  studentId,
  viewer,
  app,
  onEdit,
  onDelete,
  scrollOnMount,
}: {
  prompt: PromptWithEssay;
  index: number;
  open: boolean;
  onToggle: () => void;
  school: SchoolWithEssays;
  studentId: string;
  viewer: Viewer;
  app: ApplicationsApi;
  onEdit: () => void;
  onDelete: () => void;
  scrollOnMount: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const bodyId = useId();
  const status = essayStatusOf(prompt);
  const words = prompt.essay?.word_count ?? 0;
  const over = prompt.word_limit > 0 && words > prompt.word_limit;
  const isCounselor = viewer === 'counselor';

  useEffect(() => {
    if (scrollOnMount) ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    // Only on mount: the deep-linked prompt scrolls into view once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section ref={ref} className="scroll-mt-6 border-b border-portal-line">
      <div className={cx('group relative flex items-stretch transition-colors', open ? 'bg-portal-select' : 'hover:bg-portal-hover')}>
        <span
          aria-hidden="true"
          className={cx(
            'absolute inset-y-0 left-0 w-[2px] origin-top bg-portal-accent transition-transform duration-300 ease-portal',
            open ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100',
          )}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-start gap-4 py-5 pl-4 pr-2 text-left sm:gap-6 sm:pl-5"
        >
          <span className={cx('pt-1 font-mono text-xs tabular-nums', open ? 'text-portal-accent-light' : 'text-portal-dim')}>
            {pad2(index + 1)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-serif text-lg leading-snug text-portal-text">{prompt.title}</span>
            <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <StatusTag status={status} />
              <span className={cx('font-mono text-[11px] tabular-nums', over ? 'text-portal-red' : 'text-portal-muted')}>
                {words} / {prompt.word_limit} words
              </span>
            </span>
            <LineMeter value={words} max={prompt.word_limit} className="mt-3 max-w-md" />
          </span>
          <IconChevronDown
            size={16}
            className={cx('mt-1 flex-none text-portal-dim transition-transform duration-300 ease-portal', open && 'rotate-180 text-portal-accent-light')}
          />
        </button>
        {isCounselor && (
          <div className="flex flex-none items-start gap-1 py-4 pr-2">
            <IconButton aria-label={`Edit prompt ${prompt.title}`} onClick={onEdit}>
              <IconEdit size={15} />
            </IconButton>
            <IconButton aria-label={`Delete prompt ${prompt.title}`} tone="danger" onClick={onDelete}>
              <IconTrash size={15} />
            </IconButton>
          </div>
        )}
      </div>

      {open && (
        <div id={bodyId} className="animate-rise pb-8 pl-4 pr-1 sm:pl-[3.25rem]">
          {prompt.prompt_text ? (
            <blockquote className="mb-6 max-w-3xl whitespace-pre-line border-l border-portal-accent/50 py-1 pl-4 font-serif text-[15px] italic leading-relaxed text-portal-body">
              {prompt.prompt_text}
            </blockquote>
          ) : (
            <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim">No prompt text added</p>
          )}
          <EssayEditor prompt={prompt} school={school} studentId={studentId} viewer={viewer} app={app} />
        </div>
      )}
    </section>
  );
}

/* --------------------------------------------------------------------------
   SchoolDetail
   -------------------------------------------------------------------------- */

type DialogState =
  | { kind: 'edit-school' }
  | { kind: 'delete-school' }
  | { kind: 'add-prompt' }
  | { kind: 'edit-prompt'; prompt: PromptWithEssay }
  | { kind: 'delete-prompt'; prompt: PromptWithEssay }
  | null;

export default function SchoolDetail({
  school,
  app,
  studentId,
  viewer,
  onBack,
  focusPromptId,
}: {
  school: SchoolWithEssays;
  app: ApplicationsApi;
  studentId: string;
  viewer: Viewer;
  onBack: () => void;
  focusPromptId?: string;
}) {
  const now = useNow();
  const [openId, setOpenId] = useState<string | null>(focusPromptId ?? null);
  const [seenFocus, setSeenFocus] = useState(focusPromptId);
  if (seenFocus !== focusPromptId) {
    setSeenFocus(focusPromptId);
    if (focusPromptId) setOpenId(focusPromptId);
  }
  const [dialog, setDialog] = useState<DialogState>(null);
  const isCounselor = viewer === 'counselor';
  const closeDialog = () => setDialog(null);

  const prompts = school.prompts;
  const done = prompts.filter(isEssayDone).length;
  const totalWords = prompts.reduce((sum, p) => sum + (p.essay?.word_count ?? 0), 0);
  const plan = school.decision_plan?.trim();

  const addPromptButton = isCounselor ? (
    <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'add-prompt' })}>
      <IconPlus size={14} />
      Add prompt
    </Button>
  ) : undefined;

  return (
    <Panel>
      <button
        type="button"
        onClick={onBack}
        className="animate-fade mb-8 inline-flex min-h-8 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-portal-muted transition-colors hover:text-portal-accent-light"
      >
        <IconArrowLeft size={14} />
        All schools
      </button>

      <PanelHeader
        index="02"
        eyebrow={school.is_common_app ? 'Common App' : 'Schools & Essays'}
        title={school.name}
        description={school.program || undefined}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setDialog({ kind: 'edit-school' })}>
              <IconEdit size={14} />
              Edit school
            </Button>
            <Button size="sm" variant="danger" onClick={() => setDialog({ kind: 'delete-school' })}>
              <IconTrash size={14} />
              Delete
            </Button>
          </>
        }
      />

      <div className="animate-rise mb-6 flex flex-wrap items-center gap-2">
        {school.is_common_app ? <Tag tone="accent">Common App</Tag> : <CategoryTag category={school.category} />}
        {plan && <Tag>{plan}</Tag>}
        <span className="ml-1 font-mono text-[11px] text-portal-muted">
          {school.deadline ? `Due ${formatDate(school.deadline, { month: 'long', day: 'numeric', year: 'numeric' })}, ${relativeDays(school.deadline).toLowerCase()}` : 'No deadline set'}
        </span>
      </div>

      <StatRow className="mb-10">
        <DeadlineStat school={school} now={now} />
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
          <SegmentBar value={done} max={Math.max(prompts.length, 1)} segments={Math.max(prompts.length, 1) * 4} tone="green" label="Essays final" className="mt-4 max-w-[180px]" />
        </div>
        <Stat value={totalWords.toLocaleString('en-US')} label="Words written" />
      </StatRow>

      {school.notes?.trim() && (
        <div className="animate-rise mb-12">
          <SectionLabel>Notes</SectionLabel>
          <p className="max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-portal-body">{school.notes}</p>
        </div>
      )}

      <SectionLabel action={prompts.length > 0 ? addPromptButton : undefined}>
        Essay prompts{prompts.length > 0 ? ` (${prompts.length})` : ''}
      </SectionLabel>

      {prompts.length === 0 ? (
        isCounselor ? (
          <EmptyState
            title="No prompts yet"
            body="Add the essay prompts for this school. Your student will see them here and can start writing right away."
            action={addPromptButton}
          />
        ) : (
          <EmptyState
            title="No prompts yet"
            body="Your counselor adds the essay prompts for each school. They will show up here as soon as they are added."
          />
        )
      ) : (
        <div className="stagger border-t border-portal-line-strong">
          {prompts.map((prompt, i) => (
            <PromptSection
              key={prompt.id}
              prompt={prompt}
              index={i}
              open={openId === prompt.id}
              onToggle={() => setOpenId((cur) => (cur === prompt.id ? null : prompt.id))}
              school={school}
              studentId={studentId}
              viewer={viewer}
              app={app}
              onEdit={() => setDialog({ kind: 'edit-prompt', prompt })}
              onDelete={() => setDialog({ kind: 'delete-prompt', prompt })}
              scrollOnMount={Boolean(focusPromptId) && focusPromptId === prompt.id}
            />
          ))}
        </div>
      )}

      {dialog?.kind === 'edit-school' && (
        <SchoolFormDialog
          title="Edit school"
          submitLabel="Save changes"
          initial={{
            name: school.name,
            program: school.program ?? '',
            category: school.category,
            decision_plan: school.decision_plan ?? '',
            deadline: school.deadline ?? '',
            notes: school.notes ?? '',
            is_common_app: Boolean(school.is_common_app),
          }}
          onSubmit={(values) => app.updateSchool(school.id, values)}
          onClose={closeDialog}
        />
      )}

      {dialog?.kind === 'delete-school' && (
        <ConfirmDialog
          title={`Delete ${school.name}?`}
          confirmLabel="Delete school"
          body={
            <>
              This removes the school and everything under it: all {prompts.length === 1 ? '1 prompt' : `${prompts.length} prompts`}, every
              essay written for them, and all comments on those essays. This cannot be undone.
            </>
          }
          onConfirm={async () => {
            await app.deleteSchool(school.id);
            onBack();
          }}
          onClose={closeDialog}
        />
      )}

      {dialog?.kind === 'add-prompt' && (
        <PromptFormDialog
          title="Add prompt"
          submitLabel="Add prompt"
          onSubmit={(values) =>
            app.addPrompt({
              school_id: school.id,
              ...values,
              sort_order: prompts.length > 0 ? Math.max(...prompts.map((p) => p.sort_order)) + 1 : 1,
            })
          }
          onClose={closeDialog}
        />
      )}

      {dialog?.kind === 'edit-prompt' && (
        <PromptFormDialog
          title="Edit prompt"
          submitLabel="Save changes"
          initial={{ title: dialog.prompt.title, prompt_text: dialog.prompt.prompt_text ?? '', word_limit: dialog.prompt.word_limit }}
          onSubmit={(values) => app.updatePrompt(dialog.prompt.id, values)}
          onClose={closeDialog}
        />
      )}

      {dialog?.kind === 'delete-prompt' && (
        <ConfirmDialog
          title="Delete this prompt?"
          confirmLabel="Delete prompt"
          body={
            <>
              <span className="font-serif text-portal-text">{dialog.prompt.title}</span> will be removed, along with the student&apos;s essay for
              it and every comment on that essay. This cannot be undone.
            </>
          }
          onConfirm={async () => {
            const id = dialog.prompt.id;
            await app.deletePrompt(id);
            if (openId === id) setOpenId(null);
            setDialog(null);
          }}
          onClose={closeDialog}
        />
      )}
    </Panel>
  );
}
