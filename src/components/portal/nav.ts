/* ==========================================================================
   Portal navigation model shared by the shell and every panel.
   ========================================================================== */

export type Viewer = 'student' | 'counselor';

export type StudentTab = 'dashboard' | 'schools' | 'tasks' | 'activities' | 'messages' | 'files' | 'resources' | 'settings';

export type CounselorTab = 'c-dashboard' | 'c-students' | 'c-reviews' | 'c-tasks' | 'c-messages' | 'c-prompts' | 'c-files' | 'c-settings';

/** Optional deep link inside a student tab (e.g. open a school or an essay). */
export interface StudentFocus {
  schoolId?: string;
  promptId?: string;
}

/** Props every student-facing panel receives. */
export interface StudentPanelProps {
  /** Whose data to show. Equals the signed-in user for students. */
  studentId: string;
  /** Who is looking. Counselors see the same panels with extra controls. */
  viewer: Viewer;
  onNavigate: (tab: StudentTab, focus?: StudentFocus) => void;
  /** Deep link target, if the panel was opened with one. */
  focus?: StudentFocus;
}

/** Props every counselor panel receives. */
export interface CounselorPanelProps {
  onNavigate: (tab: CounselorTab) => void;
  /** Jump into a student's portal, optionally to a tab and deep link. */
  onOpenStudent: (studentId: string, tab?: StudentTab, focus?: StudentFocus) => void;
}

export interface TabDef<T extends string> {
  id: T;
  label: string;
  group: string;
  /** Single key used with "g" for keyboard navigation (g then key). */
  hotkey: string;
}

export const STUDENT_TABS: TabDef<StudentTab>[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Overview', hotkey: 'd' },
  { id: 'schools', label: 'Schools & Essays', group: 'Applications', hotkey: 's' },
  { id: 'tasks', label: 'Tasks', group: 'Applications', hotkey: 't' },
  { id: 'activities', label: 'Activities', group: 'Applications', hotkey: 'a' },
  { id: 'messages', label: 'Messages', group: 'Together', hotkey: 'm' },
  { id: 'files', label: 'Shared Files', group: 'Together', hotkey: 'f' },
  { id: 'resources', label: 'Resources', group: 'Help', hotkey: 'r' },
  { id: 'settings', label: 'Settings', group: 'Help', hotkey: ',' },
];

export const COUNSELOR_TABS: TabDef<CounselorTab>[] = [
  { id: 'c-dashboard', label: 'Dashboard', group: 'Overview', hotkey: 'd' },
  { id: 'c-students', label: 'Students', group: 'Overview', hotkey: 's' },
  { id: 'c-reviews', label: 'Essay Reviews', group: 'Work', hotkey: 'e' },
  { id: 'c-tasks', label: 'Task Manager', group: 'Work', hotkey: 't' },
  { id: 'c-messages', label: 'Messages', group: 'Work', hotkey: 'm' },
  { id: 'c-prompts', label: 'Prompt Library', group: 'Library', hotkey: 'p' },
  { id: 'c-files', label: 'Files', group: 'Library', hotkey: 'f' },
  { id: 'c-settings', label: 'Settings', group: 'Library', hotkey: ',' },
];

export function isStudentTab(value: string): value is StudentTab {
  return STUDENT_TABS.some((t) => t.id === value);
}

export function isCounselorTab(value: string): value is CounselorTab {
  return COUNSELOR_TABS.some((t) => t.id === value);
}
