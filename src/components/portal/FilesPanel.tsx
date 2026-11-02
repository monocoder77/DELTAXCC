'use client';

/* ==========================================================================
   Shared files: a dashed drop zone for uploads, a "shelf" that shows the
   library as one segmented bar sized by bytes, and ruled folder sections.
   FileTable, UploadZone and FileShelf are reused by the counselor file
   manager.
   ========================================================================== */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import { FILE_FOLDERS, MAX_UPLOAD_BYTES, errorMessage, useFiles, useMe, useProfile } from '@/lib/hooks';
import type { Profile, SharedFile } from '@/types/database';
import type { StudentPanelProps } from './nav';
import {
  Button,
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
  Stat,
  StatRow,
  cx,
  formatBytes,
  formatDate,
  pad2,
  toneColor,
} from './ui/primitives';
import type { Tone } from './ui/primitives';
import { IconCheck, IconClose, IconExternal, IconSearch, IconTrash, IconUpload } from './ui/icons';

/* --------------------------------------------------------------------------
   File kinds (from the extension)
   -------------------------------------------------------------------------- */

interface FileKind {
  label: string;
  name: string;
  tone: Tone;
}

const KIND_GROUPS: {
  label: string;
  name: string;
  tone: Tone;
  exts: string[];
}[] = [
  { label: 'PDF', name: 'PDF', tone: 'red', exts: ['pdf'] },
  {
    label: 'DOC',
    name: 'Documents',
    tone: 'blue',
    exts: ['doc', 'docx', 'odt', 'rtf', 'pages'],
  },
  { label: 'TXT', name: 'Text', tone: 'neutral', exts: ['txt', 'md'] },
  {
    label: 'XLS',
    name: 'Spreadsheets',
    tone: 'green',
    exts: ['xls', 'xlsx', 'csv', 'numbers', 'ods'],
  },
  {
    label: 'PPT',
    name: 'Slides',
    tone: 'amber',
    exts: ['ppt', 'pptx', 'key', 'odp'],
  },
  {
    label: 'IMG',
    name: 'Images',
    tone: 'gold',
    exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg', 'bmp', 'tif', 'tiff'],
  },
  {
    label: 'ZIP',
    name: 'Archives',
    tone: 'neutral',
    exts: ['zip', 'rar', '7z'],
  },
];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

export function fileKind(name: string): FileKind {
  const ext = extensionOf(name);
  const group = KIND_GROUPS.find((g) => g.exts.includes(ext));
  if (group) return { label: group.label, name: group.name, tone: group.tone };
  return {
    label: ext ? ext.slice(0, 4).toUpperCase() : 'FILE',
    name: 'Other',
    tone: 'accent',
  };
}

/** Square file-type badge with a folded corner. */
function FileBadge({ name }: { name: string }) {
  const kind = fileKind(name);
  const color = toneColor[kind.tone];
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-9 w-9 flex-none items-end justify-start border px-1 pb-1 font-mono text-[9px] font-bold leading-none tracking-[0.06em]"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 50%, transparent)`,
      }}
    >
      <span
        className="absolute -right-px -top-px h-2 w-2 border-b border-l bg-portal-bg"
        style={{ borderColor: `color-mix(in srgb, ${color} 50%, transparent)` }}
      />
      {kind.label}
    </span>
  );
}

/* --------------------------------------------------------------------------
   Shared helpers
   -------------------------------------------------------------------------- */

function newestFirst(a: SharedFile, b: SharedFile) {
  return (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
}

export type FileSort = 'newest' | 'name' | 'size';

export const FILE_SORTS: { id: FileSort; label: string }[] = [
  { id: 'newest', label: 'Newest' },
  { id: 'name', label: 'Name' },
  { id: 'size', label: 'Size' },
];

export function sortFiles(files: SharedFile[], sort: FileSort): SharedFile[] {
  const out = [...files];
  if (sort === 'name')
    out.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    );
  else if (sort === 'size') out.sort((a, b) => (b.size_bytes ?? 0) - (a.size_bytes ?? 0) || newestFirst(a, b));
  else out.sort(newestFirst);
  return out;
}

/** Display name for whoever uploaded a file. Unknown people are the counselor (students cannot see counselor profiles). */
export function uploaderName(file: SharedFile, meId: string | undefined, peopleById: Record<string, Profile>): string {
  if (meId && file.uploaded_by === meId) return 'You';
  return peopleById[file.uploaded_by]?.full_name || 'Counselor';
}

/** Folder names in a stable order: the standard folders first, then any others alphabetically. */
export function orderFolders(names: Iterable<string>): string[] {
  const standard: readonly string[] = FILE_FOLDERS;
  return [...new Set(names)].sort((a, b) => {
    const ia = standard.indexOf(a);
    const ib = standard.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b);
  });
}

/** Search box plus Newest / Name / Size toggle. */
export function LibraryControls({
  idPrefix,
  query,
  onQuery,
  sort,
  onSort,
  placeholder = 'Search files',
  children,
}: {
  idPrefix: string;
  query: string;
  onQuery: (q: string) => void;
  sort: FileSort;
  onSort: (s: FileSort) => void;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end">
      <div className="relative min-w-0 flex-1">
        <label htmlFor={`${idPrefix}-search`} className="sr-only">
          Search files
        </label>
        <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-portal-dim" />
        <Input
          id={`${idPrefix}-search`}
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      {children}
      <div role="group" aria-label="Sort files" className="flex h-10 flex-none border border-portal-line-strong">
        {FILE_SORTS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={sort === s.id}
            onClick={() => onSort(s.id)}
            className={cx(
              'min-w-16 flex-1 px-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
              i > 0 && 'border-l border-portal-line-strong',
              sort === s.id ? 'bg-portal-select text-portal-accent-light' : 'text-portal-muted hover:text-portal-text',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Shelf: the whole library as one bar, each file a segment sized by bytes
   -------------------------------------------------------------------------- */

const SHELF_MAX_SEGMENTS = 48;

export function FileShelf({ files, label = 'Library by type' }: { files: SharedFile[]; label?: string }) {
  const total = files.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
  const ordered = useMemo(
    () =>
      [...files].sort((a, b) => {
        const ka = fileKind(a.name).name;
        const kb = fileKind(b.name).name;
        return ka === kb ? (b.size_bytes ?? 0) - (a.size_bytes ?? 0) : ka.localeCompare(kb);
      }),
    [files],
  );
  const legend = useMemo(() => {
    const map = new Map<string, { tone: Tone; count: number; bytes: number }>();
    for (const f of files) {
      const k = fileKind(f.name);
      const entry = map.get(k.name) ?? { tone: k.tone, count: 0, bytes: 0 };
      entry.count += 1;
      entry.bytes += f.size_bytes ?? 0;
      map.set(k.name, entry);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [files]);

  if (files.length === 0) return null;

  // One segment per file reads well for a personal library; a large library collapses to one segment per type.
  const segments =
    files.length <= SHELF_MAX_SEGMENTS
      ? ordered.map((f) => ({
          key: f.id,
          title: `${f.name} (${formatBytes(f.size_bytes ?? 0)})`,
          color: toneColor[fileKind(f.name).tone],
          share: total > 0 ? (f.size_bytes ?? 0) / total : 1 / files.length,
        }))
      : legend.map(([name, v]) => ({
          key: name,
          title: `${name}: ${v.count} (${formatBytes(v.bytes)})`,
          color: toneColor[v.tone],
          share: total > 0 ? v.bytes / total : v.count / files.length,
        }));

  return (
    <figure className="mt-8">
      <figcaption className="mb-3 flex items-baseline justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">
        <span>{label}</span>
        <span className="tabular-nums text-portal-dim">{formatBytes(total)}</span>
      </figcaption>
      <div
        className="animate-grow-x flex h-3 gap-[2px] overflow-hidden"
        role="img"
        aria-label={legend.map(([name, v]) => `${name}: ${v.count}`).join(', ')}
      >
        {segments.map((seg) => (
          <span
            key={seg.key}
            title={seg.title}
            className="h-full min-w-[3px] opacity-80 transition-opacity duration-150 hover:opacity-100"
            style={{
              flexGrow: Math.max(seg.share, 0.004),
              flexBasis: 0,
              background: seg.color,
            }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {legend.map(([name, v]) => (
          <li key={name} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-portal-muted">
            <span aria-hidden="true" className="h-2 w-2" style={{ background: toneColor[v.tone] }} />
            {name}
            <span className="tabular-nums text-portal-dim">{v.count}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* --------------------------------------------------------------------------
   FileTable: ruled rows with open + delete (delete confirms in a Dialog)
   -------------------------------------------------------------------------- */

export function FileTable({
  files,
  peopleById,
  onOpen,
  onDelete,
  canDelete,
  showStudent = false,
  showFolder = false,
}: {
  files: SharedFile[];
  peopleById: Record<string, Profile>;
  onOpen: (f: SharedFile) => Promise<void>;
  onDelete: (f: SharedFile) => Promise<void>;
  canDelete: (f: SharedFile) => boolean;
  showStudent?: boolean;
  /** Show the folder under each name (useful when rows are not grouped by folder). */
  showFolder?: boolean;
}) {
  const me = useMe();
  const [opening, setOpening] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<SharedFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const setRowError = useCallback((id: string, message: string | null) => {
    setRowErrors((prev) => {
      const next = { ...prev };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }, []);

  // Called straight from the click so the hook can open the new tab inside the user gesture.
  const handleOpen = (f: SharedFile) => {
    setOpening(f.id);
    setRowError(f.id, null);
    onOpen(f)
      .catch((err) => setRowError(f.id, `Could not open this file. ${errorMessage(err)}`))
      .finally(() => setOpening((cur) => (cur === f.id ? null : cur)));
  };

  const closeConfirm = () => {
    if (deleting) return;
    setConfirm(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!confirm) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(confirm);
      setConfirm(null);
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        aria-hidden="true"
        className="hidden grid-cols-[2.25rem_minmax(0,1fr)_9rem_6.5rem_5rem_7.5rem] gap-x-4 border-b border-portal-line pb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim md:grid"
      >
        <span />
        <span>File</span>
        <span>Shared by</span>
        <span>Added</span>
        <span className="text-right">Size</span>
        <span />
      </div>
      <ul className="stagger">
        {files.map((f) => {
          const who = uploaderName(f, me?.id, peopleById);
          const added = formatDate(f.created_at, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          const size = formatBytes(f.size_bytes ?? 0);
          const student = showStudent ? peopleById[f.student_id]?.full_name || 'Student' : null;
          const context = [student, showFolder ? f.folder || 'General' : null].filter(Boolean).join(' / ');
          const rowError = rowErrors[f.id];
          const deletable = canDelete(f);
          return (
            <li key={f.id} className="group relative border-b border-portal-line">
              <span
                aria-hidden="true"
                className="absolute -left-3 top-1/2 h-0 w-px -translate-y-1/2 bg-portal-accent transition-all duration-300 ease-portal group-hover:h-8 group-focus-within:h-8"
              />
              <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-4 py-3 md:grid-cols-[2.25rem_minmax(0,1fr)_9rem_6.5rem_5rem_7.5rem]">
                <FileBadge name={f.name} />
                <div className="min-w-0">
                  <p className="truncate text-sm text-portal-text" title={f.name}>
                    {f.name}
                  </p>
                  {context && (
                    <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-portal-muted">{context}</p>
                  )}
                  <p className="mt-0.5 truncate font-mono text-[10px] text-portal-dim md:hidden">
                    {who}, {added}, {size}
                  </p>
                </div>
                <span className="hidden truncate text-xs text-portal-body md:block">{who}</span>
                <span className="hidden font-mono text-[11px] tabular-nums text-portal-muted md:block">{added}</span>
                <span className="hidden text-right font-mono text-[11px] tabular-nums text-portal-muted md:block">{size}</span>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpen(f)}
                    disabled={opening === f.id}
                    aria-label={`Open ${f.name}`}
                  >
                    <IconExternal size={13} />
                    <span className="hidden sm:inline">{opening === f.id ? 'Opening' : 'Open'}</span>
                  </Button>
                  {deletable && (
                    <IconButton
                      tone="danger"
                      aria-label={`Delete ${f.name}`}
                      onClick={() => {
                        setDeleteError(null);
                        setConfirm(f);
                      }}
                    >
                      <IconTrash size={15} />
                    </IconButton>
                  )}
                </div>
              </div>
              {rowError && (
                <p role="alert" className="-mt-1 flex items-start gap-2 pb-3 pl-[3.25rem] text-xs text-portal-red">
                  <span className="min-w-0 flex-1">{rowError}</span>
                  <button
                    type="button"
                    className="flex-none font-mono text-[10px] uppercase tracking-[0.14em] text-portal-muted hover:text-portal-text"
                    onClick={() => setRowError(f.id, null)}
                  >
                    Dismiss
                  </button>
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog
        open={confirm !== null}
        onClose={closeConfirm}
        title="Delete this file?"
        footer={
          <>
            <Button variant="ghost" onClick={closeConfirm} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              <IconTrash size={14} />
              {deleting ? 'Deleting' : 'Delete file'}
            </Button>
          </>
        }
      >
        {confirm && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-y border-portal-line py-3">
              <FileBadge name={confirm.name} />
              <div className="min-w-0">
                <p className="truncate text-sm text-portal-text">{confirm.name}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-portal-muted">
                  {confirm.folder || 'General'}, {formatBytes(confirm.size_bytes ?? 0)}
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-portal-body">
              This removes the file for everyone it is shared with, student and counselor. It cannot be undone.
            </p>
            {deleteError && (
              <p role="alert" className="text-sm text-portal-red">
                {deleteError}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}

/* --------------------------------------------------------------------------
   UploadZone: dashed drop area + folder select + per-file status rows
   -------------------------------------------------------------------------- */

type UploadStatus = 'uploading' | 'done' | 'error' | 'waiting';

interface UploadItem {
  key: number;
  name: string;
  size: number;
  folder: string;
  /** Who the file was for, captured when it was dropped (counselor uploads). */
  target?: string;
  status: UploadStatus;
  error?: string;
}

export function UploadZone({
  idPrefix,
  onUpload,
  disabled = false,
  disabledHint,
  fields,
  hint,
  targetLabel,
}: {
  idPrefix: string;
  onUpload: (folder: string, file: File) => Promise<void>;
  disabled?: boolean;
  /** Name of who new uploads are for, shown on each status row (e.g. the chosen student). */
  targetLabel?: string;
  /** Shown in the drop zone when disabled (e.g. "Choose a student first"). */
  disabledHint?: string;
  /** Extra fields shown above the folder select (e.g. a student picker). */
  fields?: ReactNode;
  hint?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef(0);
  const [folder, setFolder] = useState<string>('General');
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);

  const busy = items.some((i) => i.status === 'uploading' || i.status === 'waiting');
  const finished = items.some((i) => i.status === 'done' || i.status === 'error');

  const patch = (key: number, update: Partial<UploadItem>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...update } : i)));

  const handleFiles = async (list: FileList | File[] | null) => {
    if (disabled || !list) return;
    const files = Array.from(list);
    if (files.length === 0) return;
    const target = folder;
    const queued = files.map((file) => {
      keyRef.current += 1;
      const tooBig = file.size > MAX_UPLOAD_BYTES;
      const item: UploadItem = {
        key: keyRef.current,
        name: file.name,
        size: file.size,
        folder: target,
        target: targetLabel,
        status: tooBig ? 'error' : 'waiting',
        error: tooBig ? `This file is ${formatBytes(file.size)}. Files must be ${formatBytes(MAX_UPLOAD_BYTES)} or smaller.` : undefined,
      };
      return { file, item };
    });
    setItems((prev) => [...queued.map((q) => q.item).reverse(), ...prev]);

    // One at a time keeps errors readable and avoids hammering storage.
    for (const { file, item } of queued) {
      if (item.status === 'error') continue;
      patch(item.key, { status: 'uploading' });
      try {
        await onUpload(target, file);
        patch(item.key, { status: 'done' });
      } catch (err) {
        patch(item.key, { status: 'error', error: errorMessage(err) });
      }
    }
  };

  // preventDefault even when disabled so a dropped file is ignored instead of the browser navigating to it.
  const onDrag = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (disabled) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      setDragging(true);
    }
  };

  const onDragLeave = (e: DragEvent<HTMLElement>) => {
    const next = e.relatedTarget;
    if (next instanceof Node && e.currentTarget.contains(next)) return;
    setDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
  };

  const bracket = 'absolute h-3 w-3 border-portal-accent-light transition-transform duration-300 ease-portal';
  const shift = dragging ? 6 : 0;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_15rem] md:gap-0">
      <div className="space-y-4 md:order-2 md:border-l md:border-portal-line md:pl-6">
        {fields}
        <Field label="Folder" htmlFor={`${idPrefix}-folder`}>
          <Select id={`${idPrefix}-folder`} value={folder} onChange={(e) => setFolder(e.target.value)}>
            {FILE_FOLDERS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        {hint && <p className="text-xs leading-relaxed text-portal-dim">{hint}</p>}
      </div>

      <div className="min-w-0 md:order-1 md:pr-6">
        <input
          ref={inputRef}
          id={`${idPrefix}-input`}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div onDragEnter={onDrag} onDragOver={onDrag} onDragLeave={onDragLeave} onDrop={onDrop}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className={cx(
              'group relative flex min-h-[176px] w-full flex-col items-center justify-center gap-4 border border-dashed px-6 py-10 text-center transition-colors duration-200',
              dragging ? 'border-portal-accent bg-portal-select' : 'border-portal-line-strong hover:border-portal-accent-light/60',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <span
              aria-hidden="true"
              className={cx(bracket, 'left-2 top-2 border-l border-t')}
              style={{ transform: `translate(${-shift}px, ${-shift}px)` }}
            />
            <span
              aria-hidden="true"
              className={cx(bracket, 'right-2 top-2 border-r border-t')}
              style={{ transform: `translate(${shift}px, ${-shift}px)` }}
            />
            <span
              aria-hidden="true"
              className={cx(bracket, 'bottom-2 left-2 border-b border-l')}
              style={{ transform: `translate(${-shift}px, ${shift}px)` }}
            />
            <span
              aria-hidden="true"
              className={cx(bracket, 'bottom-2 right-2 border-b border-r')}
              style={{ transform: `translate(${shift}px, ${shift}px)` }}
            />

            <span aria-hidden="true" className="relative flex h-12 w-12 items-center justify-center">
              <span
                className={cx(
                  'absolute inset-1 rotate-45 border transition-all duration-500 ease-portal',
                  dragging ? 'scale-110 border-portal-accent bg-portal-accent/15' : 'border-portal-accent/50 group-hover:rotate-[135deg]',
                )}
              />
              <IconUpload size={18} className="relative text-portal-accent-light" />
            </span>
            <span>
              <span className="block font-serif text-lg text-portal-text">
                {disabled && disabledHint ? disabledHint : dragging ? 'Let go to upload' : 'Drop files here'}
              </span>
              {!disabled && (
                <span className="mt-1 block text-sm text-portal-muted">
                  or{' '}
                  <span className="text-portal-accent-light underline decoration-portal-accent/50 underline-offset-4">
                    choose from your computer
                  </span>
                </span>
              )}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-dim">
              Up to {formatBytes(MAX_UPLOAD_BYTES)} each, into {folder}
            </span>
          </button>
        </div>

        {items.length > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted" aria-live="polite">
                {busy
                  ? `Uploading ${items.filter((i) => i.status === 'uploading' || i.status === 'waiting').length}`
                  : `${items.filter((i) => i.status === 'done').length} uploaded`}
              </span>
              {finished && !busy && (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-portal-muted hover:text-portal-text"
                >
                  Clear
                </button>
              )}
            </div>
            <ul className="border-t border-portal-line">
              {items.map((item) => (
                <UploadRow key={item.key} item={item} onDismiss={() => setItems((prev) => prev.filter((i) => i.key !== item.key))} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadRow({ item, onDismiss }: { item: UploadItem; onDismiss: () => void }) {
  const tone: Tone = item.status === 'done' ? 'green' : item.status === 'error' ? 'red' : 'accent';
  const color = toneColor[tone];
  return (
    <li className="animate-rise border-b border-portal-line py-2.5">
      <div className="flex items-center gap-3">
        <FileBadge name={item.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-portal-text" title={item.name}>
            {item.name}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color }}>
            {item.status === 'waiting' && 'Waiting'}
            {item.status === 'uploading' && `Uploading to ${item.folder}`}
            {item.status === 'done' && `Saved to ${item.folder}`}
            {item.status === 'error' && 'Not uploaded'}
            {item.target && <span className="normal-case tracking-normal">{`, for ${item.target}`}</span>}
            <span className="ml-2 normal-case tracking-normal text-portal-dim">{formatBytes(item.size)}</span>
          </p>
        </div>
        {item.status === 'done' && <IconCheck size={16} className="flex-none text-portal-green" />}
        {item.status === 'error' && (
          <IconButton aria-label={`Dismiss ${item.name}`} onClick={onDismiss}>
            <IconClose size={14} />
          </IconButton>
        )}
      </div>
      {(item.status === 'uploading' || item.status === 'waiting') && (
        <div className="relative mt-2 h-px overflow-hidden bg-portal-line-strong" aria-hidden="true">
          {/* The backend reports no byte progress, so show an honest in-flight line instead of a fake percentage. */}
          {item.status === 'uploading' && <span className="animate-pulse-soft absolute inset-y-[-1px] left-0 w-full bg-portal-accent" />}
        </div>
      )}
      {item.status === 'error' && item.error && (
        <p role="alert" className="mt-1.5 pl-[3.25rem] text-xs leading-relaxed text-portal-red">
          {item.error}
        </p>
      )}
    </li>
  );
}

/* --------------------------------------------------------------------------
   Student panel
   -------------------------------------------------------------------------- */

export default function FilesPanel({ studentId, viewer }: StudentPanelProps) {
  // Keyed so search, sort and upload status rows never carry over from one student to another.
  return <StudentFiles key={studentId} studentId={studentId} viewer={viewer} />;
}

function StudentFiles({ studentId, viewer }: Pick<StudentPanelProps, 'studentId' | 'viewer'>) {
  const me = useMe();
  const { profile: student } = useProfile(studentId);
  const { profile: consultant } = useProfile(student?.assigned_consultant_id);
  const studentIds = useMemo(() => [studentId], [studentId]);
  const { files, loading, error, upload, remove, open } = useFiles(studentIds);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<FileSort>('newest');

  const peopleById = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of [consultant, student, me]) if (p) map[p.id] = p;
    return map;
  }, [consultant, student, me]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? files.filter((f) => [f.name, f.folder, uploaderName(f, me?.id, peopleById)].some((s) => (s ?? '').toLowerCase().includes(q)))
      : files;
    return sortFiles(matched, sort);
  }, [files, query, sort, me?.id, peopleById]);

  const groups = useMemo(() => {
    const byFolder = new Map<string, SharedFile[]>();
    for (const f of filtered) {
      const key = f.folder || 'General';
      byFolder.set(key, [...(byFolder.get(key) ?? []), f]);
    }
    return orderFolders(byFolder.keys()).map((name) => ({
      name,
      files: byFolder.get(name) ?? [],
    }));
  }, [filtered]);

  const stats = useMemo(() => {
    const total = files.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
    const mine = me ? files.filter((f) => f.uploaded_by === me.id).length : 0;
    return { total, mine, theirs: files.length - mine };
  }, [files, me]);

  const isCounselor = viewer === 'counselor';
  const firstName = student?.full_name.split(/\s+/)[0] || 'this student';
  const canDelete = useCallback((f: SharedFile) => isCounselor || (!!me && f.uploaded_by === me.id), [isCounselor, me]);
  const handleUpload = useCallback(
    async (folder: string, file: File) => {
      await upload(studentId, folder, file);
    },
    [upload, studentId],
  );

  return (
    <Panel>
      <PanelHeader
        index="06"
        eyebrow="Together"
        title="Shared files"
        description={
          isCounselor
            ? `Everything shared with ${firstName}. Anything you add here appears in their portal right away.`
            : 'Drafts, resumes, worksheets and notes that you and your counselor share. Add a file and they can see it right away.'
        }
      />

      {!loading && !error && files.length > 0 && (
        <section className="mb-12">
          <StatRow>
            <Stat value={pad2(files.length)} label={files.length === 1 ? 'File' : 'Files'} />
            <Stat value={formatBytes(stats.total)} label="In total" />
            <Stat value={pad2(stats.mine)} label="Shared by you" tone="accent" />
            <Stat value={pad2(stats.theirs)} label={isCounselor ? 'Shared by others' : 'From your counselor'} />
          </StatRow>
          <FileShelf files={files} />
        </section>
      )}

      <section className="mb-14">
        <SectionLabel>Add files</SectionLabel>
        <UploadZone
          idPrefix="files"
          onUpload={handleUpload}
          disabled={!me}
          disabledHint="Sign in to upload"
          hint={
            isCounselor
              ? `${firstName} can open and download anything you add.`
              : 'Your counselor can open and download anything you add. You can delete your own uploads.'
          }
        />
      </section>

      <section>
        <SectionLabel>Library</SectionLabel>
        {loading ? (
          <LoadingBlock label="Loading files" />
        ) : error ? (
          <p role="alert" className="border-y border-portal-red/40 py-4 text-sm text-portal-red">
            Could not load files. {error}
          </p>
        ) : files.length === 0 ? (
          <EmptyState
            title="Nothing shared yet"
            body={
              isCounselor
                ? `Drop a worksheet or notes above and ${firstName} will see it in their portal.`
                : 'Drop a draft, your resume, or anything else above. Your counselor will see it right away.'
            }
          />
        ) : (
          <>
            <LibraryControls
              idPrefix="files"
              query={query}
              onQuery={setQuery}
              sort={sort}
              onSort={setSort}
              placeholder="Search by name, folder or person"
            />
            {groups.length === 0 ? (
              <div className="border-y border-dashed border-portal-line-strong py-10 text-center">
                <p className="text-sm text-portal-muted">No files match &ldquo;{query.trim()}&rdquo;.</p>
                <Button size="sm" variant="ghost" className="mt-3" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              </div>
            ) : (
              <div className="space-y-12">
                {groups.map((g, i) => (
                  <div key={g.name}>
                    <div className="mb-1 flex items-baseline gap-3 border-b border-portal-line-strong pb-2">
                      <span className="font-mono text-[10px] tabular-nums text-portal-accent-light">{pad2(i + 1)}</span>
                      <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-portal-text">{g.name}</h3>
                      <span className="font-mono text-[10px] tabular-nums text-portal-dim">
                        {g.files.length} {g.files.length === 1 ? 'file' : 'files'}
                      </span>
                    </div>
                    <FileTable files={g.files} peopleById={peopleById} onOpen={open} onDelete={remove} canDelete={canDelete} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </Panel>
  );
}
