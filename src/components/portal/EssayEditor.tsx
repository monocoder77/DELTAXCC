'use client';

/* ==========================================================================
   Essay editor: the heart of the portal.
   A calm serif column with a hairline rule, a live word meter, autosave,
   version history, a full-screen focus mode, the review status flow, and
   the feedback thread beside it. Renders inline under an expanded prompt.
   ========================================================================== */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { errorMessage, useEssayVersions, useMe, useNow } from '@/lib/hooks';
import type { ApplicationsApi, SchoolWithEssays } from '@/lib/hooks';
import { EssayConflictError, type EssayUpdates } from '@/lib/backend/types';
import { registerPendingSave } from '@/lib/pendingSaves';
import type { Essay, EssayStatus, EssayVersion, PromptWithEssay } from '@/types/database';
import type { Viewer } from './nav';
import EssayContent from './EssayContent';
import CommentThread from './CommentThread';
import {
  Button,
  Diamond,
  Dialog,
  ESSAY_STATUS,
  ESSAY_STATUS_ORDER,
  IconButton,
  Kbd,
  LineMeter,
  SectionLabel,
  Spinner,
  StatusGlyph,
  StatusTag,
  cx,
  pad2,
  timeAgo,
  toneColor,
} from './ui/primitives';
import { IconClose, IconFocus, IconHistory } from './ui/icons';

const AUTOSAVE_DELAY_MS = 1200;
const AUTO_SNAPSHOT_MS = 10 * 60 * 1000;

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }
  /** The essay changed elsewhere; autosave is paused until the user picks a version. */
  | { kind: 'conflict'; server: Essay };

/* --------------------------------------------------------------------------
   On-device draft: unsaved text survives a closed tab, a failed save, or
   leaving the screen, and is cleared once the server has it.
   -------------------------------------------------------------------------- */
interface LocalDraft {
  html: string;
  /** updated_at of the server version this draft was based on */
  base: string | null;
  /** text of that server version, to tell a real conflict from a status-only change */
  baseContent: string | null;
}

function draftKey(studentId: string, promptId: string) {
  return `deltax:essay-draft:${studentId}:${promptId}`;
}

function readDraft(key: string): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalDraft>;
    return typeof parsed.html === 'string'
      ? { html: parsed.html, base: parsed.base ?? null, baseContent: typeof parsed.baseContent === 'string' ? parsed.baseContent : null }
      : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: LocalDraft) {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage full or blocked: the server autosave still runs.
  }
}

function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
type Confirm = { kind: 'submit-over'; over: number } | { kind: 'mark-submitted' } | null;
type SnapshotResult = 'created' | 'unchanged' | 'unavailable';

function wordsOf(editor: Editor): number {
  return editor.storage.characterCount.words();
}

function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/* --------------------------------------------------------------------------
   Small glyphs the shared icon set does not cover
   -------------------------------------------------------------------------- */
function UndoGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" aria-hidden="true">
      <path d="M9 5 4 10l5 5" />
      <path d="M4 10h11a5 5 0 0 1 0 10h-3" />
    </svg>
  );
}

function RedoGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" aria-hidden="true">
      <path d="m15 5 5 5-5 5" />
      <path d="M20 10H9a5 5 0 0 0 0 10h3" />
    </svg>
  );
}

const pressedClass = 'aria-pressed:border-portal-accent/60 aria-pressed:bg-portal-select aria-pressed:text-portal-accent-light';

/* --------------------------------------------------------------------------
   Status track: six diamonds on a hairline, the current one lit
   -------------------------------------------------------------------------- */
function StatusTrack({ status }: { status: EssayStatus }) {
  const current = ESSAY_STATUS[status].step;
  return (
    <ol aria-label="Essay progress" className="flex w-full max-w-[520px] items-center">
      {ESSAY_STATUS_ORDER.map((s, i) => {
        const meta = ESSAY_STATUS[s];
        const reached = meta.step <= current;
        const isCurrent = s === status;
        const color = toneColor[ESSAY_STATUS[status].tone];
        return (
          <li key={s} aria-current={isCurrent ? 'step' : undefined} className={cx('flex items-center', i > 0 && 'flex-1')}>
            {i > 0 && (
              <span
                aria-hidden="true"
                className="mx-1.5 h-px flex-1 transition-colors duration-500"
                style={{ background: reached ? color : 'var(--color-portal-line-strong)' }}
              />
            )}
            <span className="relative flex flex-none items-center justify-center" title={meta.label}>
              <Diamond size={isCurrent ? 10 : 6} filled={reached} color={reached ? color : 'var(--color-portal-line-strong)'} />
              {isCurrent && (
                <span aria-hidden="true" className="absolute h-5 w-5 rotate-45 border animate-pulse-soft" style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }} />
              )}
              <span className="sr-only">
                {meta.label}
                {isCurrent ? ' (current)' : ''}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------------------------------------
   Save status line (mono)
   -------------------------------------------------------------------------- */
function SaveStatus({
  state,
  dirty,
  updatedAt,
  now,
  onRetry,
}: {
  state: SaveState;
  dirty: boolean;
  updatedAt: string | undefined;
  now: Date;
  onRetry: () => void;
}) {
  if (state.kind === 'conflict') {
    return (
      <span role="alert" className="inline-flex items-center gap-2 font-mono text-[11px] text-portal-amber">
        <span className="inline-block h-1.5 w-1.5 bg-portal-amber" aria-hidden="true" />
        Paused: changed elsewhere
      </span>
    );
  }
  if (state.kind === 'error') {
    return (
      <span role="alert" className="inline-flex flex-wrap items-center gap-2 font-mono text-[11px] text-portal-red">
        <span className="inline-block h-1.5 w-1.5 bg-portal-red" aria-hidden="true" />
        Not saved: {state.message}
        <button type="button" onClick={onRetry} className="h-8 border border-portal-red/50 px-2 uppercase tracking-[0.14em] hover:border-portal-red">
          Retry
        </button>
      </span>
    );
  }
  let text: string;
  if (state.kind === 'saving') text = 'Saving...';
  else if (dirty) text = 'Unsaved changes';
  else if (updatedAt) text = `Saved ${timeAgo(updatedAt, now)}`;
  else text = 'Not saved yet';
  return (
    <span aria-live="polite" className="inline-flex items-center gap-2 font-mono text-[11px] text-portal-dim">
      <span
        aria-hidden="true"
        className={cx('inline-block h-1.5 w-1.5', state.kind === 'saving' ? 'animate-pulse-soft bg-portal-accent-light' : dirty ? 'bg-portal-amber' : 'bg-portal-line-strong')}
      />
      {text}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Word count readout
   -------------------------------------------------------------------------- */
function WordReadout({ words, limit, className }: { words: number; limit: number; className?: string }) {
  const over = limit > 0 ? words - limit : 0;
  return (
    <span className={cx('font-mono text-[11px] tabular-nums', over > 0 ? 'text-portal-red' : 'text-portal-muted', className)}>
      {limit > 0 ? `${words} / ${limit} words` : `${words} words`}
      {over > 0 && <span className="ml-2">{over} over</span>}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Version history dialog
   -------------------------------------------------------------------------- */
function HistoryDialog({
  open,
  onClose,
  versions,
  loading,
  error,
  canRestore,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  versions: EssayVersion[];
  loading: boolean;
  error: string | null;
  canRestore: boolean;
  onRestore: (version: EssayVersion) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0] ?? null;

  // Start fresh (newest version, no stale error) every time the dialog opens.
  // Stable identity matters: Dialog re-focuses its first control whenever onClose changes.
  const close = useCallback(() => {
    setSelectedId(null);
    setRestoreError(null);
    onClose();
  }, [onClose]);

  async function restore() {
    if (!selected || restoring) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      await onRestore(selected);
      close();
    } catch (err) {
      setRestoreError(errorMessage(err));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Version history"
      width={880}
      footer={
        <>
          {restoreError && (
            <p role="alert" className="mr-auto self-center text-xs text-portal-red">
              {restoreError}
            </p>
          )}
          <Button variant="ghost" size="sm" onClick={close}>
            Close
          </Button>
          {canRestore && selected && (
            <Button variant="primary" size="sm" onClick={() => void restore()} disabled={restoring}>
              {restoring ? 'Restoring...' : 'Restore this version'}
            </Button>
          )}
        </>
      }
    >
      {loading ? (
        <div className="py-10">
          <Spinner label="Loading versions" />
        </div>
      ) : error ? (
        <p role="alert" className="text-sm text-portal-red">
          {error}
        </p>
      ) : versions.length === 0 ? (
        <p className="max-w-md text-sm leading-relaxed text-portal-muted">
          No versions yet. A version is saved when the essay goes to review, when a counselor changes its status, every ten minutes of writing, and whenever you press Save version.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-0">
          <ol className="portal-scroll max-h-[22vh] overflow-y-auto border-y border-portal-line md:max-h-[52vh] md:border-y-0 md:border-r md:pr-4">
            {versions.map((v, i) => {
              const active = selected?.id === v.id;
              return (
                <li key={v.id} className="border-b border-portal-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    aria-pressed={active}
                    className={cx(
                      'relative flex w-full items-baseline gap-3 py-3 pl-3 pr-2 text-left transition-colors',
                      active ? 'bg-portal-select' : 'hover:bg-portal-hover',
                    )}
                  >
                    {active && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[2px] bg-portal-accent" />}
                    <span className={cx('font-mono text-[10px] tabular-nums', active ? 'text-portal-accent-light' : 'text-portal-dim')}>
                      {pad2(versions.length - i)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-portal-text">{formatStamp(v.created_at)}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-portal-muted">{v.word_count} words</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="min-w-0 md:pl-6">
            {selected && (
              <>
                <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">
                  Preview · {formatStamp(selected.created_at)}
                </p>
                <div className="portal-scroll max-h-[46vh] overflow-y-auto border-l border-portal-line pl-5 pr-2">
                  <EssayContent html={selected.content} emptyText="This version was empty." />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* --------------------------------------------------------------------------
   EssayEditor
   -------------------------------------------------------------------------- */
export default function EssayEditor({
  prompt,
  school,
  studentId,
  viewer,
  app,
}: {
  prompt: PromptWithEssay;
  school: SchoolWithEssays;
  studentId: string;
  viewer: Viewer;
  app: ApplicationsApi;
}) {
  const me = useMe();
  const now = useNow(30_000);
  const essay = prompt.essay;
  const status: EssayStatus = essay?.status ?? 'not_started';
  const readOnly = status === 'submitted';
  const isCounselor = viewer === 'counselor';
  const limit = prompt.word_limit > 0 ? prompt.word_limit : 0;
  const { versions, loading: versionsLoading, error: versionsError, snapshot } = useEssayVersions(essay?.id);
  const focusLabelId = useId();

  /* ---- Live refs so async work always sees the latest values ------------ */
  const appRef = useRef(app);
  const snapshotRef = useRef(snapshot);
  const versionsRef = useRef(versions);
  const versionsLoadingRef = useRef(versionsLoading);
  const essayIdRef = useRef<string | null>(essay?.id ?? null);
  const statusRef = useRef<EssayStatus>(status);
  useEffect(() => {
    appRef.current = app;
    draftKeyRef.current = draftKeyValue;
    snapshotRef.current = snapshot;
    versionsRef.current = versions;
    versionsLoadingRef.current = versionsLoading;
    if (essay) {
      essayIdRef.current = essay.id;
      statusRef.current = essay.status;
    }
  });

  /* ---- Save engine ------------------------------------------------------ */
  const latestRef = useRef({ html: essay?.content ?? '', words: essay?.word_count ?? 0 });
  const lastSyncedRef = useRef(essay?.content ?? '');
  /** Server version (updated_at) the editor's text is based on; saves only apply on top of it. */
  const baseUpdatedAtRef = useRef<string | null>(essay?.updated_at ?? null);
  const conflictRef = useRef(false);
  const draftKeyValue = draftKey(studentId, prompt.id);
  const draftKeyRef = useRef(draftKeyValue);
  const revRef = useRef(0);
  const savedRevRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const ensuringRef = useRef<Promise<{ essay: Essay; created: boolean }> | null>(null);
  const snapAnchorRef = useRef<number | null>(null);

  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const [versionNote, setVersionNote] = useState<{ text: string; error: boolean } | null>(null);
  const [savingVersion, setSavingVersion] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [statusBusy, setStatusBusy] = useState<EssayStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const ensureEssayId = useCallback(async (): Promise<string> => {
    if (essayIdRef.current) return essayIdRef.current;
    if (!ensuringRef.current) {
      ensuringRef.current = appRef.current.ensureEssay(prompt.id, studentId);
    }
    try {
      const { essay: found, created } = await ensuringRef.current;
      essayIdRef.current = found.id;
      statusRef.current = found.status;
      // A row already existed with text this editor never saw (written on another device):
      // don't overwrite it, ask which version to keep.
      if (!created && (found.content ?? '') !== lastSyncedRef.current && (found.content ?? '').replace(/<[^>]*>/g, '').trim()) {
        throw new EssayConflictError(found);
      }
      baseUpdatedAtRef.current = found.updated_at;
      return found.id;
    } finally {
      ensuringRef.current = null;
    }
  }, [prompt.id, studentId]);

  const flashVersionNote = useCallback((text: string, error = false) => {
    setVersionNote({ text, error });
    if (!error) setTimeout(() => setVersionNote((n) => (n?.text === text ? null : n)), 2600);
  }, []);

  /** Store the current text as a version unless it matches the newest one. */
  const takeSnapshot = useCallback(async (): Promise<SnapshotResult> => {
    const { html, words } = latestRef.current;
    if (versionsRef.current[0]?.content === html) {
      snapAnchorRef.current = Date.now();
      return 'unchanged';
    }
    const created = await snapshotRef.current(html, words);
    if (!created) return 'unavailable';
    snapAnchorRef.current = Date.now();
    return 'created';
  }, []);

  /** Persist pending edits. Resolves true when everything typed so far is saved. */
  const save = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    while (inFlightRef.current) await inFlightRef.current;
    if (conflictRef.current) return false;
    if (revRef.current === savedRevRef.current) return true;

    const rev = revRef.current;
    const { html, words } = latestRef.current;
    const run = (async () => {
      setSaveState({ kind: 'saving' });
      const id = await ensureEssayId();
      const attempt = () => {
        const updates: EssayUpdates = { content: html, word_count: words };
        if (statusRef.current === 'not_started') updates.status = 'draft';
        return appRef.current.updateEssay(id, updates, baseUpdatedAtRef.current ?? undefined);
      };
      let updated: Essay;
      try {
        updated = await attempt();
      } catch (err) {
        // Only the status or timestamp moved (e.g. a counselor approved it): rebase and retry once.
        if (err instanceof EssayConflictError && err.current && err.current.content === lastSyncedRef.current) {
          baseUpdatedAtRef.current = err.current.updated_at;
          statusRef.current = err.current.status;
          updated = await attempt();
        } else {
          throw err;
        }
      }
      statusRef.current = updated.status;
      baseUpdatedAtRef.current = updated.updated_at;
      lastSyncedRef.current = html;
      savedRevRef.current = Math.max(savedRevRef.current, rev);
    })();
    const settled = run.then(
      () => undefined,
      () => undefined,
    );
    inFlightRef.current = settled;
    try {
      await run;
      setSaveState({ kind: 'idle' });
      const stillDirty = revRef.current !== savedRevRef.current;
      setDirty(stillDirty);
      if (!stillDirty) clearDraft(draftKeyRef.current);
      if (stillDirty && !timerRef.current) timerRef.current = setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
      const anchor = snapAnchorRef.current;
      if (anchor !== null && !versionsLoadingRef.current && Date.now() - anchor >= AUTO_SNAPSHOT_MS) {
        // Move the anchor first so overlapping saves cannot each take a snapshot.
        snapAnchorRef.current = Date.now();
        takeSnapshot().catch((err) => flashVersionNote(`Version not saved: ${errorMessage(err)}`, true));
      }
      return true;
    } catch (err) {
      if (err instanceof EssayConflictError && err.current) {
        conflictRef.current = true;
        setSaveState({ kind: 'conflict', server: err.current });
      } else {
        setSaveState({ kind: 'error', message: errorMessage(err) });
      }
      return false;
    } finally {
      if (inFlightRef.current === settled) inFlightRef.current = null;
    }
  }, [ensureEssayId, takeSnapshot, flashVersionNote]);

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const handleUpdate = useCallback((e: Editor) => {
    latestRef.current = { html: e.getHTML(), words: wordsOf(e) };
    writeDraft(draftKeyRef.current, { html: latestRef.current.html, base: baseUpdatedAtRef.current, baseContent: lastSyncedRef.current });
    revRef.current += 1;
    if (snapAnchorRef.current === null) snapAnchorRef.current = Date.now();
    setDirty(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void saveRef.current(), AUTOSAVE_DELAY_MS);
  }, []);
  const handleUpdateRef = useRef(handleUpdate);
  useEffect(() => {
    handleUpdateRef.current = handleUpdate;
  }, [handleUpdate]);

  /* ---- Editor ----------------------------------------------------------- */
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing. Your work saves automatically.' }),
      CharacterCount,
    ],
    content: essay?.content ?? '',
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'tiptap',
        'aria-label': `Essay for ${prompt.title}`,
        'aria-multiline': 'true',
        role: 'textbox',
      },
      // Cmd/Ctrl+S saves right away instead of opening the browser's save dialog.
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 's') {
          event.preventDefault();
          void saveRef.current();
          return true;
        }
        return false;
      },
    },
    onCreate: ({ editor: e }) => {
      latestRef.current = { html: e.getHTML(), words: wordsOf(e) };
    },
    onUpdate: ({ editor: e }) => handleUpdateRef.current(e),
  });

  const ui = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
            words: wordsOf(e),
          }
        : null,
  });
  const words = ui?.words ?? essay?.word_count ?? 0;
  const over = limit > 0 ? words - limit : 0;

  // Keep editability in step with status (no update event, so no save).
  useEffect(() => {
    editor?.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  // Pull in server changes, but never over the top of unsaved edits.
  const serverContent = essay?.content ?? '';
  const serverUpdatedAt = essay?.updated_at ?? null;
  useEffect(() => {
    if (!editor) return;
    if (serverContent === lastSyncedRef.current) {
      // Same text (e.g. only the status changed): build on the newer version.
      if (serverUpdatedAt && !conflictRef.current) baseUpdatedAtRef.current = serverUpdatedAt;
      return;
    }
    if (revRef.current !== savedRevRef.current || inFlightRef.current || conflictRef.current) return;
    lastSyncedRef.current = serverContent;
    baseUpdatedAtRef.current = serverUpdatedAt;
    if (editor.getHTML() !== serverContent) {
      editor.commands.setContent(serverContent, { emitUpdate: false });
      latestRef.current = { html: editor.getHTML(), words: wordsOf(editor) };
    }
  }, [editor, serverContent, serverUpdatedAt]);

  // Bring back unsaved text from this device (closed tab, failed save, signed out).
  const [restoredNote, setRestoredNote] = useState(false);
  useEffect(() => {
    if (!editor || readOnly) return;
    const draft = readDraft(draftKeyRef.current);
    if (!draft) return;
    if (draft.html === (editor.getHTML() ?? '') || draft.html === lastSyncedRef.current) {
      clearDraft(draftKeyRef.current);
      return;
    }
    // Saves will only apply if the server is still at the version the draft was based on;
    // otherwise the conflict prompt lets the student choose.
    // A draft with no base was written before the essay existed on the server. If a row
    // exists now, use a base that can never match so the save asks instead of overwriting.
    baseUpdatedAtRef.current = draft.base ?? (essayIdRef.current ? '1970-01-01T00:00:00.000Z' : null);
    // Compare future conflicts against the text the draft started from, not what just loaded.
    lastSyncedRef.current = draft.baseContent ?? '\u0000unknown-base';
    editor.commands.setContent(draft.html, { emitUpdate: true });
    setRestoredNote(true);
    // Run once per mounted editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Let sign-out write pending edits first.
  useEffect(() => registerPendingSave(() => saveRef.current()), []);

  /* ---- Conflict resolution ---------------------------------------------- */
  const conflict = saveState.kind === 'conflict' ? saveState.server : null;
  const [resolving, setResolving] = useState(false);

  async function resolveConflict(choice: 'theirs' | 'mine') {
    if (!editor || !conflict || resolving) return;
    setResolving(true);
    try {
      const mine = latestRef.current;
      const server = conflict;
      // Keep the version that is not chosen in history so nothing is ever lost.
      try {
        if (choice === 'theirs') await snapshotRef.current(mine.html, mine.words);
        else await snapshotRef.current(server.content, server.word_count);
      } catch {
        // Version history unavailable: still resolve, the local draft remains as a backup.
      }
      conflictRef.current = false;
      baseUpdatedAtRef.current = server.updated_at;
      statusRef.current = server.status;
      if (choice === 'theirs') {
        lastSyncedRef.current = server.content;
        editor.commands.setContent(server.content, { emitUpdate: false });
        latestRef.current = { html: editor.getHTML(), words: wordsOf(editor) };
        savedRevRef.current = revRef.current;
        clearDraft(draftKeyRef.current);
        setDirty(false);
        setSaveState({ kind: 'idle' });
      } else {
        lastSyncedRef.current = server.content;
        revRef.current += 1;
        await save();
      }
    } finally {
      setResolving(false);
    }
  }

  // Flush on unmount (the local draft covers a failed flush).
  useEffect(
    () => () => {
      void saveRef.current();
    },
    [],
  );

  // Save when the tab is hidden, and warn before leaving with unsaved work.
  const unsaved = dirty || saveState.kind !== 'idle';
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void saveRef.current();
    };
    document.addEventListener('visibilitychange', onHide);
    if (!unsaved) return () => document.removeEventListener('visibilitychange', onHide);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [unsaved]);

  /* ---- Focus mode ------------------------------------------------------- */
  // If the essay gets locked while focus mode is open, leave focus mode for good
  // (otherwise it would pop back open when a counselor reopens the essay).
  if (focus && readOnly) setFocus(false);
  const focusActive = focus && !readOnly;
  const focusButtonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusActive) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    editor?.commands.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setFocus(false);
        return;
      }
      // Keep Tab inside the overlay (it is a modal surface).
      const root = overlayRef.current;
      if (e.key !== 'Tab' || !root) return;
      const items = Array.from(
        root.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!root.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const button = focusButtonRef.current;
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      button?.focus();
    };
  }, [focusActive, editor]);

  /* ---- Versions --------------------------------------------------------- */
  async function saveVersion() {
    if (savingVersion) return;
    setSavingVersion(true);
    try {
      const saved = await save();
      if (!saved) throw new Error('Save your latest edits first.');
      const result = await takeSnapshot();
      if (result === 'created') flashVersionNote('Version saved');
      else if (result === 'unchanged') flashVersionNote('No changes since the last version');
      else flashVersionNote('Version history is not ready yet. Try again in a moment.', true);
    } catch (err) {
      flashVersionNote(`Version not saved: ${errorMessage(err)}`, true);
    } finally {
      setSavingVersion(false);
    }
  }

  async function restoreVersion(version: EssayVersion) {
    if (!editor || readOnly) throw new Error('This essay cannot be edited right now.');
    const saved = await save();
    if (!saved) throw new Error('Your latest edits did not save. Retry saving first, then restore.');
    await takeSnapshot();
    editor.commands.setContent(version.content, { emitUpdate: true });
    if (!(await save())) throw new Error('The restored text is in the editor but did not save yet. Use Retry below the editor.');
  }

  /* ---- Status flow ------------------------------------------------------ */
  async function changeStatus(next: EssayStatus) {
    if (statusBusy) return;
    setConfirm(null);
    setStatusBusy(next);
    setStatusError(null);
    try {
      const saved = await save();
      if (!saved) throw new Error('Your latest edits did not save. Retry saving first.');
      const id = await ensureEssayId();
      try {
        await takeSnapshot();
      } catch (err) {
        flashVersionNote(`Version not saved: ${errorMessage(err)}`, true);
      }
      await appRef.current.setEssayStatus(id, next);
      statusRef.current = next;
      if (next === 'submitted') setFocus(false);
    } catch (err) {
      setStatusError(errorMessage(err));
    } finally {
      setStatusBusy(null);
    }
  }

  function submitForReview() {
    if (over > 0) setConfirm({ kind: 'submit-over', over });
    else void changeStatus('in_review');
  }

  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const closeConfirm = useCallback(() => setConfirm(null), []);

  const addComment = useCallback(
    async (text: string) => {
      const id = await ensureEssayId();
      return appRef.current.addComment(id, text);
    },
    [ensureEssayId],
  );

  /* ---- Render ----------------------------------------------------------- */
  const statusActions: ReactNode[] = [];
  const busy = statusBusy !== null;
  const actionLabel = (target: EssayStatus, idle: string, pending: string) => (statusBusy === target ? pending : idle);
  if (!isCounselor) {
    if (status === 'draft' || status === 'revision') {
      statusActions.push(
        <Button key="review" variant="primary" size="sm" onClick={submitForReview} disabled={busy || words === 0}>
          {actionLabel('in_review', 'Submit for review', 'Submitting...')}
        </Button>,
      );
    }
    if (status === 'final') {
      statusActions.push(
        <Button key="submitted" variant="primary" size="sm" onClick={() => setConfirm({ kind: 'mark-submitted' })} disabled={busy}>
          {actionLabel('submitted', 'Mark as submitted', 'Saving...')}
        </Button>,
      );
    }
  } else {
    if (status === 'in_review') {
      statusActions.push(
        <Button key="revision" variant="outline" size="sm" onClick={() => void changeStatus('revision')} disabled={busy}>
          {actionLabel('revision', 'Request revision', 'Sending...')}
        </Button>,
      );
    }
    if (status === 'draft' || status === 'in_review' || status === 'revision') {
      statusActions.push(
        <Button key="final" variant="primary" size="sm" onClick={() => void changeStatus('final')} disabled={busy || words === 0}>
          {actionLabel('final', 'Approve as final', 'Approving...')}
        </Button>,
      );
    }
    if (status === 'final') {
      statusActions.push(
        <Button key="back" variant="outline" size="sm" onClick={() => void changeStatus('in_review')} disabled={busy}>
          {actionLabel('in_review', 'Move back to review', 'Moving...')}
        </Button>,
      );
    }
    if (status === 'submitted') {
      statusActions.push(
        <Button key="reopen" variant="outline" size="sm" onClick={() => void changeStatus('final')} disabled={busy}>
          {actionLabel('final', 'Reopen', 'Reopening...')}
        </Button>,
      );
    }
  }

  const statusNote = (() => {
    switch (status) {
      case 'not_started':
        return isCounselor ? 'Nothing written yet.' : 'Start writing below. Your draft is created the moment you type.';
      case 'draft':
        return isCounselor ? 'The student is drafting. You can approve it or leave feedback.' : 'When it feels ready, send it to your counselor for review.';
      case 'in_review':
        return isCounselor
          ? 'Waiting on your review. Approve it, or request a revision with notes.'
          : 'Your counselor is reviewing this draft. You can keep editing, and your changes save as usual.';
      case 'revision':
        return isCounselor ? 'Revision requested. The student is working on it.' : 'Your counselor asked for a revision. Read the feedback, then submit again.';
      case 'final':
        return isCounselor ? 'Approved as final.' : 'Approved as final. Mark it as submitted once it is in your application.';
      case 'submitted':
        return isCounselor ? 'Submitted and locked. Reopen it to make changes.' : 'Submitted. The essay is locked until your counselor reopens it.';
    }
  })();

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:gap-0">
      {/* ---------------- Writing column ---------------- */}
      <div className="min-w-0 xl:pr-10">
        {/* Status */}
        <div className="mb-8 border-y border-portal-line py-5">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim">Status</p>
              <p className="flex items-center gap-3">
                <StatusGlyph status={status} size={14} />
                <span className="font-serif text-2xl leading-none" style={{ color: toneColor[ESSAY_STATUS[status].tone] }}>
                  {ESSAY_STATUS[status].label}
                </span>
              </p>
            </div>
            {statusActions.length > 0 && <div className="flex flex-wrap items-center gap-2">{statusActions}</div>}
          </div>
          <div className="mt-5">
            <StatusTrack status={status} />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-portal-body">{statusNote}</p>
          {statusError && (
            <p role="alert" className="mt-2 text-sm text-portal-red">
              {statusError}
            </p>
          )}
        </div>

        {isCounselor && !readOnly && (
          <p className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-portal-accent-light">
            <Diamond size={5} />
            Counselor edits are saved to the student&apos;s essay
          </p>
        )}

        {readOnly ? (
          <div>
            <div className="max-w-[68ch] border-l border-portal-line pl-5 sm:pl-7">
              <EssayContent html={essay?.content} />
            </div>
            <div className="mt-6 max-w-[68ch] pl-5 sm:pl-7">
              <LineMeter value={words} max={limit} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <WordReadout words={words} limit={limit} />
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} disabled={!essay}>
                    <IconHistory size={14} /> History
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={overlayRef}
            role={focusActive ? 'dialog' : undefined}
            aria-modal={focusActive ? true : undefined}
            aria-labelledby={focusActive ? focusLabelId : undefined}
            className={cx(focusActive && 'portal-scroll animate-fade fixed inset-0 z-[55] overflow-y-auto bg-portal-bg')}
          >
            {focusActive && (
              <div className="sticky top-0 z-10 border-b border-portal-line bg-portal-bg/95 backdrop-blur-sm">
                <div className="mx-auto flex max-w-[1100px] items-center gap-4 px-5 py-3 sm:px-8">
                  <span className="hidden sm:inline-flex">
                    <StatusTag status={status} />
                  </span>
                  <p id={focusLabelId} className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">
                    <span className="text-portal-accent-light">Focus</span>
                    <span className="mx-2 text-portal-dim">/</span>
                    {school.name}
                    <span className="mx-2 text-portal-dim">/</span>
                    {prompt.title}
                  </p>
                  <span className="hidden sm:inline-flex">
                    <SaveStatus state={saveState} dirty={dirty} updatedAt={essay?.updated_at} now={now} onRetry={() => void save()} />
                  </span>
                  <WordReadout words={words} limit={limit} className="text-xs" />
                  <span className="hidden items-center gap-1.5 font-mono text-[10px] text-portal-dim md:inline-flex">
                    <Kbd>Esc</Kbd> to exit
                  </span>
                  <IconButton aria-label="Exit focus mode" onClick={() => setFocus(false)}>
                    <IconClose size={15} />
                  </IconButton>
                </div>
                <LineMeter value={words} max={limit} className="!bg-portal-line" />
              </div>
            )}

            <div className={cx(focusActive && 'relative mx-auto w-full max-w-[76ch] px-5 pb-40 pt-14 sm:px-8 [&_.tiptap]:min-h-[60vh] [&_.tiptap]:text-[1.14rem]')}>
              {focusActive && (
                <>
                  <span aria-hidden="true" className="pointer-events-none absolute left-0 top-8 h-4 w-4 border-l border-t border-portal-accent/50" />
                  <span aria-hidden="true" className="pointer-events-none absolute right-0 top-8 h-4 w-4 border-r border-t border-portal-accent/50" />
                </>
              )}

              {conflict && (
                <div role="alert" className="mb-5 max-w-[68ch] border-l-2 border-portal-amber py-1 pl-4">
                  <p className="text-sm font-medium text-portal-text">This essay changed somewhere else while you were editing.</p>
                  <p className="mt-1 text-sm text-portal-body">
                    {conflict.updated_at ? `The other version was saved ${timeAgo(conflict.updated_at, now)}. ` : ''}
                    Autosave is paused. Pick which text to keep; the other one is saved to History so nothing is lost.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" disabled={resolving} onClick={() => void resolveConflict('mine')}>
                      Keep my version
                    </Button>
                    <Button size="sm" disabled={resolving} onClick={() => void resolveConflict('theirs')}>
                      Use the other version
                    </Button>
                  </div>
                </div>
              )}
              {restoredNote && !conflict && (
                <p className="mb-4 flex max-w-[68ch] items-center justify-between gap-3 border-l-2 border-portal-accent py-1 pl-4 text-sm text-portal-body">
                  Restored unsaved changes from this device.
                  <button type="button" className="font-mono text-[10px] uppercase tracking-[0.14em] text-portal-muted hover:text-portal-text" onClick={() => setRestoredNote(false)}>
                    Dismiss
                  </button>
                </p>
              )}

              {/* Toolbar */}
              <div className="mb-4 flex max-w-[68ch] flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1" role="toolbar" aria-label="Formatting">
                  <IconButton
                    aria-label="Bold"
                    aria-pressed={ui?.bold ?? false}
                    disabled={!editor}
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    className={pressedClass}
                  >
                    <span className="font-serif text-[15px] font-bold leading-none">B</span>
                  </IconButton>
                  <IconButton
                    aria-label="Italic"
                    aria-pressed={ui?.italic ?? false}
                    disabled={!editor}
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                    className={pressedClass}
                  >
                    <span className="font-serif text-[15px] italic leading-none">I</span>
                  </IconButton>
                  <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-portal-line-strong" />
                  <IconButton aria-label="Undo" disabled={!ui?.canUndo} onClick={() => editor?.chain().focus().undo().run()}>
                    <UndoGlyph />
                  </IconButton>
                  <IconButton aria-label="Redo" disabled={!ui?.canRedo} onClick={() => editor?.chain().focus().redo().run()}>
                    <RedoGlyph />
                  </IconButton>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => void saveVersion()} disabled={savingVersion || !essay}>
                    {savingVersion ? 'Saving version...' : 'Save version'}
                  </Button>
                  {/* Kept mounted (just hidden) in focus mode so focus can return to the Focus button. */}
                  <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} disabled={!essay} className={cx(focusActive && 'hidden')}>
                    <IconHistory size={14} /> History
                    {versions.length > 0 && <span className="font-mono text-[10px] text-portal-dim">{pad2(versions.length)}</span>}
                  </Button>
                  <Button
                    ref={focusButtonRef}
                    variant="ghost"
                    size="sm"
                    onClick={() => setFocus(true)}
                    disabled={!editor}
                    aria-label="Open focus mode"
                    className={cx(focusActive && 'hidden')}
                  >
                    <IconFocus size={14} /> Focus
                  </Button>
                </div>
              </div>
              {versionNote && (
                <p
                  role={versionNote.error ? 'alert' : 'status'}
                  className={cx('mb-3 font-mono text-[11px]', versionNote.error ? 'text-portal-red' : 'text-portal-accent-light')}
                >
                  {versionNote.text}
                </p>
              )}

              {/* Writing area */}
              <div className="max-w-[68ch] border-l border-portal-line pl-5 transition-colors focus-within:border-portal-accent/60 sm:pl-7">
                <EditorContent editor={editor} />
              </div>

              {!focusActive && (
                <div className="mt-6 max-w-[68ch] pl-5 sm:pl-7">
                  <LineMeter value={words} max={limit} />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <WordReadout words={words} limit={limit} />
                    <SaveStatus state={saveState} dirty={dirty} updatedAt={essay?.updated_at} now={now} onRetry={() => void save()} />
                  </div>
                </div>
              )}
              {focusActive && (
                <div className="mt-10 max-w-[68ch] pl-5 sm:hidden sm:pl-7">
                  <SaveStatus state={saveState} dirty={dirty} updatedAt={essay?.updated_at} now={now} onRetry={() => void save()} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------------- Feedback column ---------------- */}
      <aside aria-label="Feedback" className="min-w-0 border-t border-portal-line pt-8 xl:border-l xl:border-t-0 xl:pl-10 xl:pt-0">
        <SectionLabel action={<span className="font-mono text-[10px] tabular-nums text-portal-dim">{pad2(prompt.comments?.length ?? 0)}</span>}>
          Feedback
        </SectionLabel>
        <CommentThread
          comments={prompt.comments ?? []}
          viewerId={me?.id ?? ''}
          onAdd={addComment}
          placeholder={isCounselor ? 'Leave feedback...' : 'Reply to your counselor...'}
          disabled={!me}
          disabledReason="Sign in to leave a note."
        />
      </aside>

      {/* ---------------- Dialogs ---------------- */}
      <HistoryDialog
        open={historyOpen}
        onClose={closeHistory}
        versions={versions}
        loading={versionsLoading}
        error={versionsError}
        canRestore={!readOnly && Boolean(editor)}
        onRestore={restoreVersion}
      />

      <Dialog
        open={confirm?.kind === 'submit-over'}
        onClose={closeConfirm}
        title="Over the word limit"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
              Keep editing
            </Button>
            <Button variant="primary" size="sm" onClick={() => void changeStatus('in_review')} disabled={busy}>
              Submit anyway
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-portal-body">
          This draft is <span className="font-mono text-portal-red">{confirm?.kind === 'submit-over' ? confirm.over : over} words</span> over the{' '}
          {limit} word limit. You can still send it for review, and your counselor can help you trim it.
        </p>
      </Dialog>

      <Dialog
        open={confirm?.kind === 'mark-submitted'}
        onClose={closeConfirm}
        title="Mark as submitted?"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => void changeStatus('submitted')} disabled={busy}>
              Mark as submitted
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-portal-body">
          Do this once the essay is in your application for {school.name}. It becomes read-only for you and your counselor until your counselor reopens it.
        </p>
      </Dialog>
    </div>
  );
}
