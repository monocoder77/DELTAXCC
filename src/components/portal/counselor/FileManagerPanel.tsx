'use client';

/* ==========================================================================
   Counselor file manager: upload for any student, then browse every shared
   file either grouped by student (ruled sections) or as one newest-first
   ledger. Counselors can delete any file.
   ========================================================================== */

import { useCallback, useMemo, useState } from 'react';
import { useFiles, useMe, useNow, useStudents } from '@/lib/hooks';
import type { Profile, SharedFile } from '@/types/database';
import type { CounselorPanelProps } from '../nav';
import {
  Avatar,
  Button,
  EmptyState,
  Field,
  LoadingBlock,
  Panel,
  PanelHeader,
  SectionLabel,
  Select,
  Stat,
  StatRow,
  cx,
  formatBytes,
  pad2,
  toneColor,
} from '../ui/primitives';
import { IconArrowRight } from '../ui/icons';
import { FileShelf, FileTable, LibraryControls, UploadZone, fileKind, sortFiles, uploaderName } from '../FilesPanel';
import type { FileSort } from '../FilesPanel';

type View = 'students' | 'ledger';

const VIEWS: { id: View; label: string }[] = [
  { id: 'students', label: 'By student' },
  { id: 'ledger', label: 'All files' },
];

const WEEK_MS = 7 * 86_400_000;
const MAX_TICKS = 24;

/** A tiny run of squares, one per file, colored by file type. */
function KindTicks({ files }: { files: SharedFile[] }) {
  if (files.length === 0) return null;
  const shown = files.slice(0, MAX_TICKS);
  return (
    <span aria-hidden="true" className="hidden items-center gap-[3px] sm:flex">
      {shown.map((f) => (
        <span key={f.id} className="h-2 w-2" style={{ background: toneColor[fileKind(f.name).tone], opacity: 0.85 }} />
      ))}
      {files.length > MAX_TICKS && <span className="ml-1 font-mono text-[10px] text-portal-dim">+{files.length - MAX_TICKS}</span>}
    </span>
  );
}

export default function FileManagerPanel({ onOpenStudent, onNavigate }: CounselorPanelProps) {
  const me = useMe();
  const now = useNow();
  const { students, loading: studentsLoading, error: studentsError, reload: reloadStudents } = useStudents();
  const studentIds = useMemo(() => students.map((s) => s.id), [students]);
  const { files, loading: filesLoading, error: filesError, upload, remove, open } = useFiles(studentIds);

  const [uploadStudent, setUploadStudent] = useState('');
  const [filterStudent, setFilterStudent] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<FileSort>('newest');
  const [view, setView] = useState<View>('students');

  const peopleById = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const s of students) map[s.id] = s;
    if (me) map[me.id] = me;
    return map;
  }, [students, me]);

  const stats = useMemo(() => {
    const total = files.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0);
    const recent = files.filter((f) => {
      const t = Date.parse(f.created_at);
      return !Number.isNaN(t) && now.getTime() - t < WEEK_MS;
    }).length;
    const withFiles = new Set(files.map((f) => f.student_id)).size;
    return { total, recent, withFiles };
  }, [files, now]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scoped = filterStudent === 'all' ? files : files.filter((f) => f.student_id === filterStudent);
    const matched = q
      ? scoped.filter((f) =>
          [f.name, f.folder, peopleById[f.student_id]?.full_name, uploaderName(f, me?.id, peopleById)].some((s) =>
            (s ?? '').toLowerCase().includes(q),
          ),
        )
      : scoped;
    return sortFiles(matched, sort);
  }, [files, filterStudent, query, sort, peopleById, me?.id]);

  const sections = useMemo(() => {
    const searching = query.trim().length > 0;
    const byStudent = new Map<string, SharedFile[]>();
    for (const f of filtered) byStudent.set(f.student_id, [...(byStudent.get(f.student_id) ?? []), f]);
    return students
      .filter((s) => filterStudent === 'all' || s.id === filterStudent)
      .map((s) => ({ student: s, files: byStudent.get(s.id) ?? [] }))
      .filter((sec) => !searching || sec.files.length > 0);
  }, [filtered, students, filterStudent, query]);

  // Only a student that is still in the list counts as chosen (the list can reload underneath the select).
  const uploadTarget = useMemo(() => students.find((s) => s.id === uploadStudent), [students, uploadStudent]);
  const uploadTargetId = uploadTarget?.id;

  const canDelete = useCallback(() => true, []);
  const handleUpload = useCallback(
    async (folder: string, file: File) => {
      if (!uploadTargetId) throw new Error('Choose a student first.');
      await upload(uploadTargetId, folder, file);
    },
    [upload, uploadTargetId],
  );

  return (
    <Panel wide>
      <PanelHeader
        index="07"
        eyebrow="Library"
        title="Files"
        description="Share worksheets, notes and guides with any student, and find everything they have uploaded in one place."
      />

      {studentsLoading ? (
        <LoadingBlock label="Loading students" />
      ) : studentsError ? (
        <div role="alert" className="flex flex-wrap items-center gap-4 border-y border-portal-red/40 py-4 text-sm text-portal-red">
          <span className="min-w-0 flex-1">Could not load your students. {studentsError}</span>
          <Button size="sm" variant="outline" onClick={reloadStudents}>
            Try again
          </Button>
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          title="No students yet"
          body="Once a student is assigned to you, you can share files with them here."
          action={
            <Button variant="primary" onClick={() => onNavigate('c-students')}>
              Go to students
            </Button>
          }
        />
      ) : (
        <>
          {!filesLoading && !filesError && (
            <section className="mb-12">
              <StatRow>
                <Stat value={pad2(files.length)} label={files.length === 1 ? 'File' : 'Files'} />
                <Stat value={formatBytes(stats.total)} label="In total" />
                <Stat value={`${pad2(stats.withFiles)}/${pad2(students.length)}`} label="Students with files" />
                <Stat value={pad2(stats.recent)} label="Added this week" tone={stats.recent > 0 ? 'accent' : 'neutral'} />
              </StatRow>
              <FileShelf files={files} label="Every shared file, by type" />
            </section>
          )}

          <section className="mb-14">
            <SectionLabel>Share a file</SectionLabel>
            <UploadZone
              idPrefix="fm"
              onUpload={handleUpload}
              disabled={!uploadTarget || !me}
              targetLabel={uploadTarget ? uploadTarget.full_name || uploadTarget.email : undefined}
              disabledHint={!me ? 'Sign in to upload' : 'Choose a student first'}
              fields={
                <Field label="Student" htmlFor="fm-student">
                  <Select id="fm-student" value={uploadTarget ? uploadStudent : ''} onChange={(e) => setUploadStudent(e.target.value)}>
                    <option value="">Choose a student</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name || s.email}
                      </option>
                    ))}
                  </Select>
                </Field>
              }
              hint={
                uploadTarget
                  ? `${uploadTarget.full_name.split(/\s+/)[0] || 'They'} will see new files in their Shared Files tab.`
                  : 'Pick who the file is for. They will see it in their Shared Files tab.'
              }
            />
          </section>

          <section>
            <SectionLabel
              action={
                <div role="group" aria-label="View" className="flex border border-portal-line-strong">
                  {VIEWS.map((v, i) => (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={view === v.id}
                      onClick={() => setView(v.id)}
                      className={cx(
                        'h-8 px-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
                        i > 0 && 'border-l border-portal-line-strong',
                        view === v.id ? 'bg-portal-select text-portal-accent-light' : 'text-portal-muted hover:text-portal-text',
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              }
            >
              Student files
            </SectionLabel>

            {filesLoading ? (
              <LoadingBlock label="Loading files" />
            ) : filesError ? (
              <p role="alert" className="border-y border-portal-red/40 py-4 text-sm text-portal-red">
                Could not load files. {filesError}
              </p>
            ) : files.length === 0 ? (
              <EmptyState title="No files shared yet" body="Pick a student above and drop in a worksheet or notes to get started." />
            ) : (
              <>
                <LibraryControls
                  idPrefix="fm"
                  query={query}
                  onQuery={setQuery}
                  sort={sort}
                  onSort={setSort}
                  placeholder="Search every file by name, folder or student"
                >
                  <div className="md:w-56">
                    <label htmlFor="fm-filter" className="sr-only">
                      Filter by student
                    </label>
                    <Select id="fm-filter" value={filterStudent} onChange={(e) => setFilterStudent(e.target.value)}>
                      <option value="all">All students</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name || s.email}
                        </option>
                      ))}
                    </Select>
                  </div>
                </LibraryControls>

                {view === 'ledger' ? (
                  filtered.length === 0 ? (
                    <NoMatches onClear={() => { setQuery(''); setFilterStudent('all'); }} />
                  ) : (
                    <FileTable
                      files={filtered}
                      peopleById={peopleById}
                      onOpen={open}
                      onDelete={remove}
                      canDelete={canDelete}
                      showStudent
                      showFolder
                    />
                  )
                ) : sections.length === 0 ? (
                  <NoMatches onClear={() => { setQuery(''); setFilterStudent('all'); }} />
                ) : (
                  <div className="space-y-12">
                    {sections.map(({ student, files: list }) => (
                      <div key={student.id}>
                        <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-portal-line-strong pb-3">
                          <Avatar initials={student.avatar_initials} size={30} />
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-serif text-lg font-bold text-portal-text">{student.full_name || student.email}</h3>
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-portal-dim">
                              {list.length} {list.length === 1 ? 'file' : 'files'}
                              {list.length > 0 && `, ${formatBytes(list.reduce((sum, f) => sum + (f.size_bytes ?? 0), 0))}`}
                            </p>
                          </div>
                          <KindTicks files={list} />
                          <Button size="sm" variant="ghost" onClick={() => onOpenStudent(student.id, 'files')}>
                            Open portal
                            <IconArrowRight size={13} />
                          </Button>
                        </div>
                        {list.length > 0 ? (
                          <FileTable
                            files={list}
                            peopleById={peopleById}
                            onOpen={open}
                            onDelete={remove}
                            canDelete={canDelete}
                            showFolder
                          />
                        ) : (
                          <p className="border-b border-portal-line py-4 text-sm text-portal-dim">
                            No files yet.{' '}
                            <button
                              type="button"
                              className="text-portal-accent-light underline decoration-portal-accent/50 underline-offset-4 hover:text-portal-text"
                              onClick={() => {
                                setUploadStudent(student.id);
                                const select = document.getElementById('fm-student');
                                select?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                select?.focus({ preventScroll: true });
                              }}
                            >
                              Share one with {student.full_name.split(/\s+/)[0] || 'them'}
                            </button>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </Panel>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="border-y border-dashed border-portal-line-strong py-10 text-center">
      <p className="text-sm text-portal-muted">No files match these filters.</p>
      <Button size="sm" variant="ghost" className="mt-3" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
