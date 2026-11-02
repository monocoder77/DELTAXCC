'use client';

/* ==========================================================================
   Portal shell: layout, routing, sidebar, command palette, hotkeys.
   Used by /portal (Supabase) and /portal/demo (sample data).
   ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useApplications, useProfile, useStudents, useTasks } from '@/lib/hooks';
import type { Profile } from '@/types/database';
import {
  COUNSELOR_TABS,
  STUDENT_TABS,
  isCounselorTab,
  isStudentTab,
  type CounselorPanelProps,
  type CounselorTab,
  type StudentFocus,
  type StudentPanelProps,
  type StudentTab,
} from './nav';
import { useHashRoute } from './useHashRoute';
import Sidebar from './Sidebar';
import CommandPalette, { type Command } from './CommandPalette';
import { Ambient, Button, IconButton, LoadingBlock, daysUntil } from './ui/primitives';
import { IconArrowLeft, IconClose, IconMenu, IconSearch } from './ui/icons';

import DashboardPanel from './DashboardPanel';
import SchoolsPanel from './SchoolsPanel';
import TasksPanel from './TasksPanel';
import ActivitiesPanel from './ActivitiesPanel';
import MessagesPanel from './MessagesPanel';
import FilesPanel from './FilesPanel';
import ResourcesPanel from './ResourcesPanel';
import SettingsPanel from './SettingsPanel';
import CounselorDashboard from './counselor/CounselorDashboard';
import MyStudentsPanel from './counselor/MyStudentsPanel';
import EssayReviewsPanel from './counselor/EssayReviewsPanel';
import TaskManagerPanel from './counselor/TaskManagerPanel';
import CounselorMessagesPanel from './counselor/CounselorMessagesPanel';
import PromptLibraryPanel from './counselor/PromptLibraryPanel';
import FileManagerPanel from './counselor/FileManagerPanel';

type BadgeMap<T extends string> = Partial<Record<T, { count: number; tone: 'red' | 'amber' | 'accent' }>>;

export default function PortalApp({ banner, onSignedOut }: { banner?: ReactNode; onSignedOut?: () => void }) {
  const { profile, loading, user, signOut } = useAuth();

  const handleSignOut = useCallback(async () => {
    await signOut();
    if (onSignedOut) onSignedOut();
    else window.location.assign('/portal/login');
  }, [signOut, onSignedOut]);

  if (loading) {
    return (
      <div className="relative min-h-dvh bg-portal-bg">
        <Ambient />
        <div className="relative z-10">
          <LoadingBlock label="Opening your portal" />
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center bg-portal-bg px-6">
        <Ambient />
        <div className="relative z-10 max-w-sm text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-portal-muted">Portal</p>
          <h1 className="mt-3 font-serif text-2xl font-bold text-portal-text">
            {user ? "Your account isn't set up yet" : 'You are signed out'}
          </h1>
          <p className="mt-3 text-sm text-portal-body">
            {user
              ? 'Your login works, but there is no portal profile attached to it. Contact your DeltaX counselor.'
              : 'Sign in to continue.'}
          </p>
          <div className="mt-8 flex justify-center gap-2">
            {user ? (
              <Button onClick={() => void handleSignOut()}>Sign out</Button>
            ) : (
              <a href="/portal/login" className="inline-flex h-10 items-center border border-portal-accent bg-portal-accent px-4 text-sm font-medium text-white">
                Sign in
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <PortalLayout me={profile} banner={banner} onSignOut={() => void handleSignOut()} />;
}

function PortalLayout({ me, banner, onSignOut }: { me: Profile; banner?: ReactNode; onSignOut: () => void }) {
  const { route, navigate } = useHashRoute();
  const isCounselor = me.role === 'consultant';
  const viewingId = isCounselor ? route.studentId : null;
  const { profile: viewingStudent } = useProfile(viewingId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Resolve the current screen from the URL.
  const mode: 'student' | 'counselor' | 'viewing' = !isCounselor ? 'student' : viewingId ? 'viewing' : 'counselor';
  const studentTab: StudentTab = route.tab && isStudentTab(route.tab) ? route.tab : 'dashboard';
  const counselorTab: CounselorTab = route.tab && isCounselorTab(route.tab) ? route.tab : 'c-dashboard';
  const studentId = mode === 'student' ? me.id : viewingId ?? '';
  const studentTabs = useMemo(
    () => (mode === 'viewing' ? STUDENT_TABS.filter((t) => t.id !== 'settings' && t.id !== 'resources') : STUDENT_TABS),
    [mode],
  );
  const activeKey = mode === 'counselor' ? counselorTab : studentTab;

  /* Navigation ------------------------------------------------------------ */
  const goStudentTab = useCallback(
    (tab: StudentTab, focus: StudentFocus = {}) => {
      setMenuOpen(false);
      navigate({ tab, studentId: viewingId, focus });
    },
    [navigate, viewingId],
  );

  const goCounselorTab = useCallback(
    (tab: CounselorTab) => {
      setMenuOpen(false);
      navigate({ tab, studentId: null, focus: {} });
    },
    [navigate],
  );

  const openStudent = useCallback(
    (id: string, tab: StudentTab = 'dashboard', focus: StudentFocus = {}) => {
      setMenuOpen(false);
      navigate({ tab, studentId: id, focus });
    },
    [navigate],
  );

  const exitStudent = useCallback(() => goCounselorTab('c-students'), [goCounselorTab]);

  // Scroll to the top when the screen changes.
  const screenKey = `${mode}:${activeKey}:${studentId}`;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screenKey]);

  /* Hotkeys: Ctrl/Cmd+K palette, "g" then a letter to jump ---------------- */
  const pendingG = useRef<number | null>(null);
  useEffect(() => {
    const tabs = mode === 'counselor' ? COUNSELOR_TABS : studentTabs;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      const target = e.target as HTMLElement | null;
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const tab = tabs.find((t) => t.hotkey === e.key.toLowerCase());
        if (tab) {
          e.preventDefault();
          if (mode === 'counselor') goCounselorTab(tab.id as CounselorTab);
          else goStudentTab(tab.id as StudentTab);
        }
        return;
      }
      if (e.key === 'g') {
        pendingG.current = window.setTimeout(() => {
          pendingG.current = null;
        }, 900);
      } else if (e.key === '/' ) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, studentTabs, goCounselorTab, goStudentTab]);

  /* Panel ----------------------------------------------------------------- */
  const studentProps: StudentPanelProps = {
    studentId,
    viewer: mode === 'student' ? 'student' : 'counselor',
    onNavigate: goStudentTab,
    focus: route.focus,
  };
  const counselorProps: CounselorPanelProps = { onNavigate: goCounselorTab, onOpenStudent: openStudent };

  let panel: ReactNode;
  if (mode === 'viewing' && !studentId) {
    panel = <LoadingBlock />;
  } else if (mode === 'counselor') {
    panel = {
      'c-dashboard': <CounselorDashboard {...counselorProps} />,
      'c-students': <MyStudentsPanel {...counselorProps} />,
      'c-reviews': <EssayReviewsPanel {...counselorProps} />,
      'c-tasks': <TaskManagerPanel {...counselorProps} />,
      'c-messages': <CounselorMessagesPanel {...counselorProps} />,
      'c-prompts': <PromptLibraryPanel {...counselorProps} />,
      'c-files': <FileManagerPanel {...counselorProps} />,
      'c-settings': <SettingsPanel />,
    }[counselorTab];
  } else {
    const tab = mode === 'viewing' && (studentTab === 'settings' || studentTab === 'resources') ? 'dashboard' : studentTab;
    panel = {
      dashboard: <DashboardPanel {...studentProps} />,
      schools: <SchoolsPanel {...studentProps} />,
      tasks: <TasksPanel {...studentProps} />,
      activities: <ActivitiesPanel {...studentProps} />,
      messages: <MessagesPanel {...studentProps} />,
      files: <FilesPanel {...studentProps} />,
      resources: <ResourcesPanel {...studentProps} />,
      settings: <SettingsPanel />,
    }[tab];
  }

  const activeLabel =
    mode === 'counselor'
      ? COUNSELOR_TABS.find((t) => t.id === counselorTab)?.label
      : STUDENT_TABS.find((t) => t.id === studentTab)?.label;

  const sidebar =
    mode === 'counselor' ? (
      <CounselorBadges>
        {(badges) => (
          <Sidebar
            tabs={COUNSELOR_TABS}
            activeTab={counselorTab}
            onSelect={goCounselorTab}
            me={me}
            subtitle="Counselor Portal"
            badges={badges}
            onOpenPalette={() => setPaletteOpen(true)}
            onSignOut={onSignOut}
          />
        )}
      </CounselorBadges>
    ) : (
      <StudentBadges studentId={studentId}>
        {(badges) => (
          <Sidebar
            tabs={studentTabs}
            activeTab={studentTab}
            onSelect={(t) => goStudentTab(t)}
            me={me}
            subtitle={mode === 'viewing' ? 'Counselor Portal' : 'Student Portal'}
            badges={badges}
            viewingStudent={mode === 'viewing' ? viewingStudent : null}
            onExitStudent={exitStudent}
            onOpenPalette={() => setPaletteOpen(true)}
            onSignOut={onSignOut}
          />
        )}
      </StudentBadges>
    );

  return (
    <div className="relative min-h-dvh bg-portal-bg text-portal-text">
      <Ambient calm={studentTab === 'schools' && mode !== 'counselor'} />

      <div className="relative z-10">
        {banner}

        <div className="flex">
          {/* Desktop sidebar */}
          <aside className="sticky top-0 hidden h-dvh flex-none lg:block">{sidebar}</aside>

          {/* Mobile drawer */}
          {menuOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="animate-fade absolute inset-0 bg-[#05030a]/80" onClick={() => setMenuOpen(false)} />
              <div className="animate-rise absolute inset-y-0 left-0">{sidebar}</div>
              <IconButton
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="absolute left-[268px] top-4 border-portal-line-strong bg-portal-bg"
              >
                <IconClose size={16} />
              </IconButton>
            </div>
          )}

          <div className="min-w-0 flex-1">
            {/* Mobile top bar */}
            <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-portal-line bg-portal-bg/90 px-4 backdrop-blur-md lg:hidden">
              <IconButton aria-label="Open menu" onClick={() => setMenuOpen(true)}>
                <IconMenu size={18} />
              </IconButton>
              <span className="font-serif text-lg font-bold">DeltaX</span>
              <span className="truncate font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted">{activeLabel}</span>
              <IconButton aria-label="Search" className="ml-auto" onClick={() => setPaletteOpen(true)}>
                <IconSearch size={16} />
              </IconButton>
            </div>

            {/* Counselor viewing a student */}
            {mode === 'viewing' && (
              <div className="flex items-center gap-3 border-b border-portal-gold/30 bg-portal-bg/70 px-5 py-2.5 backdrop-blur-md sm:px-8 lg:px-12">
                <button
                  type="button"
                  onClick={exitStudent}
                  className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-portal-muted hover:text-portal-text"
                >
                  <IconArrowLeft size={12} /> Students
                </button>
                <span className="h-3 w-px bg-portal-line-strong" />
                <span className="truncate text-sm text-portal-body">
                  Viewing <span className="text-portal-gold">{viewingStudent?.full_name ?? 'student'}</span>
                  <span className="hidden sm:inline"> as their counselor. Changes save to their account.</span>
                </span>
              </div>
            )}

            <main key={screenKey}>{panel}</main>
          </div>
        </div>
      </div>

      <PortalPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        mode={mode}
        studentId={studentId}
        studentTabs={studentTabs.map((t) => ({ id: t.id, label: t.label }))}
        goStudentTab={goStudentTab}
        goCounselorTab={goCounselorTab}
        openStudent={openStudent}
        onSignOut={onSignOut}
      />
    </div>
  );
}

/* --------------------------------------------------------------------------
   Sidebar badges
   -------------------------------------------------------------------------- */
function StudentBadges({ studentId, children }: { studentId: string; children: (badges: BadgeMap<StudentTab>) => ReactNode }) {
  const ids = useMemo(() => (studentId ? [studentId] : []), [studentId]);
  const { tasks } = useTasks(ids);
  const { essays } = useApplications(ids);
  const overdue = tasks.filter((t) => !t.completed && (daysUntil(t.due_date) ?? 0) < 0).length;
  const revising = essays.filter((e) => e.status === 'revision').length;
  return <>{children({ tasks: { count: overdue, tone: 'red' }, schools: { count: revising, tone: 'accent' } })}</>;
}

function CounselorBadges({ children }: { children: (badges: BadgeMap<CounselorTab>) => ReactNode }) {
  const { students } = useStudents();
  const ids = useMemo(() => students.map((s) => s.id), [students]);
  const { tasks } = useTasks(ids);
  const { essays } = useApplications(ids);
  const overdue = tasks.filter((t) => !t.completed && (daysUntil(t.due_date) ?? 0) < 0).length;
  const reviews = essays.filter((e) => e.status === 'in_review').length;
  return <>{children({ 'c-reviews': { count: reviews, tone: 'amber' }, 'c-tasks': { count: overdue, tone: 'red' } })}</>;
}

/* --------------------------------------------------------------------------
   Command palette contents
   -------------------------------------------------------------------------- */
function PortalPalette({
  open,
  onClose,
  mode,
  studentId,
  studentTabs,
  goStudentTab,
  goCounselorTab,
  openStudent,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'student' | 'counselor' | 'viewing';
  studentId: string;
  studentTabs: { id: StudentTab; label: string }[];
  goStudentTab: (tab: StudentTab, focus?: StudentFocus) => void;
  goCounselorTab: (tab: CounselorTab) => void;
  openStudent: (id: string, tab?: StudentTab, focus?: StudentFocus) => void;
  onSignOut: () => void;
}) {
  // Only load palette data while it is open.
  const loadIds = useMemo(() => (open && mode !== 'counselor' && studentId ? [studentId] : []), [open, mode, studentId]);
  const { schoolsWithEssays } = useApplications(loadIds);
  const counselorPeople = useStudents();

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    if (mode === 'counselor') {
      COUNSELOR_TABS.forEach((t) => list.push({ id: `tab-${t.id}`, label: t.label, group: 'Go to', hint: `G ${t.hotkey.toUpperCase()}`, run: () => goCounselorTab(t.id) }));
      counselorPeople.students.forEach((s) =>
        list.push({ id: `student-${s.id}`, label: s.full_name, group: 'Students', hint: s.email, run: () => openStudent(s.id) }),
      );
    } else {
      studentTabs.forEach((t) => list.push({ id: `tab-${t.id}`, label: t.label, group: 'Go to', run: () => goStudentTab(t.id) }));
      schoolsWithEssays.forEach((s) => {
        list.push({ id: `school-${s.id}`, label: s.name, group: 'Schools', hint: s.decision_plan || undefined, run: () => goStudentTab('schools', { schoolId: s.id }) });
        s.prompts.forEach((p) =>
          list.push({
            id: `prompt-${p.id}`,
            label: `${s.name}: ${p.title}`,
            group: 'Essays',
            run: () => goStudentTab('schools', { schoolId: s.id, promptId: p.id }),
          }),
        );
      });
      if (mode === 'viewing') {
        list.push({ id: 'back', label: 'Back to all students', group: 'Counselor', run: () => goCounselorTab('c-students') });
      }
    }
    list.push({ id: 'signout', label: 'Sign out', group: 'Account', run: onSignOut });
    return list;
  }, [mode, studentTabs, schoolsWithEssays, counselorPeople.students, goStudentTab, goCounselorTab, openStudent, onSignOut]);

  return <CommandPalette open={open} onClose={onClose} commands={commands} />;
}
