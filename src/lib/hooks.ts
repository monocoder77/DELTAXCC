'use client';

/* ==========================================================================
   Portal data hooks
   Components never talk to the backend directly; they use these hooks.
   Each hook loads data, exposes loading/error state, applies optimistic
   updates, and announces mutations so other hooks on screen refresh.
   ========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBackend } from '@/lib/backend/context';
import type {
  ActivityUpdates,
  EssayUpdates,
  NewPrompt,
  NewSchool,
  PortalBackend,
  PromptUpdates,
  TableName,
  TaskUpdates,
} from '@/lib/backend/types';
import type {
  Activity,
  Conversation,
  Essay,
  EssayComment,
  EssayStatus,
  EssayVersion,
  Message,
  Profile,
  Prompt,
  PromptWithEssay,
  School,
  SharedFile,
  Task,
} from '@/types/database';

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Something went wrong.';
}

/* --------------------------------------------------------------------------
   Core: a cached async resource keyed by its inputs
   -------------------------------------------------------------------------- */
interface Resource<T> {
  data: T;
  setData: React.Dispatch<React.SetStateAction<T>>;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Identity used when emitting changes, so a hook skips reloading on its own writes. */
  source: symbol;
}

function useResource<T>(
  key: string,
  enabled: boolean,
  load: (api: PortalBackend) => Promise<T>,
  tables: TableName[],
  initial: T,
): Resource<T> {
  const { api, subscribe } = useBackend();
  const [data, setData] = useState<T>(initial);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [source] = useState(() => Symbol(key));
  const loadRef = useRef(load);
  const tablesKey = tables.join(',');

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadRef
      .current(api)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
        setLoadedKey(key);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(errorMessage(err));
        setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [api, key, enabled, nonce]);

  // Refresh when another hook changes one of our tables.
  useEffect(() => {
    const watched = tablesKey.split(',');
    return subscribe((changed, from) => {
      if (from === source) return;
      if (changed.some((t) => watched.includes(t))) setNonce((n) => n + 1);
    });
  }, [subscribe, tablesKey, source]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    data,
    setData,
    loading: enabled && loadedKey !== key,
    error,
    reload,
    source,
  };
}

/** The signed-in person (student or counselor). */
export function useMe(): Profile | null {
  return useAuth().profile;
}

/** Re-renders on an interval so countdowns stay current. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* --------------------------------------------------------------------------
   People
   -------------------------------------------------------------------------- */
export function useStudents() {
  const r = useResource<Profile[]>('students', true, (api) => api.listStudents(), ['profiles'], []);
  return { students: r.data, loading: r.loading, error: r.error, reload: r.reload };
}

export function useConsultants() {
  const r = useResource<Profile[]>('consultants', true, (api) => api.listConsultants(), ['profiles'], []);
  return { consultants: r.data, loading: r.loading, error: r.error };
}

export function useProfile(id: string | null | undefined) {
  const r = useResource<Profile | null>(`profile:${id}`, Boolean(id), (api) => api.getProfile(id!), ['profiles'], null);
  return { profile: r.data, loading: r.loading, error: r.error };
}

export function useAccountActions() {
  const { api, emit } = useBackend();
  const updateProfile = useCallback(
    async (id: string, fullName: string) => {
      const name = fullName.trim();
      if (!name) throw new Error('Name cannot be empty.');
      const initials = name
        .split(/\s+/)
        .map((part) => part[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const updated = await api.updateProfile(id, { full_name: name, avatar_initials: initials });
      emit(['profiles']);
      return updated;
    },
    [api, emit],
  );
  const updatePassword = useCallback(
    async (password: string) => {
      if (password.length < 8) throw new Error('Use at least 8 characters.');
      await api.updatePassword(password);
    },
    [api],
  );
  const createStudent = useCallback(
    async (input: { fullName: string; email: string; password: string }) => {
      const result = await api.createStudent(input);
      emit(['profiles', 'conversations']);
      return result;
    },
    [api, emit],
  );
  return { updateProfile, updatePassword, createStudent };
}

/* --------------------------------------------------------------------------
   Applications: schools, prompts, essays and comments for one or more students
   -------------------------------------------------------------------------- */
export interface ApplicationData {
  schools: School[];
  prompts: Prompt[];
  essays: Essay[];
  comments: EssayComment[];
}

const EMPTY_APP: ApplicationData = { schools: [], prompts: [], essays: [], comments: [] };

export interface SchoolWithEssays extends School {
  prompts: PromptWithEssay[];
}

/** Essay for a prompt; if several exist, the most recently updated wins. */
function pickEssay(essays: Essay[], promptId: string): Essay | undefined {
  let best: Essay | undefined;
  for (const e of essays) {
    if (e.prompt_id !== promptId) continue;
    if (!best || e.updated_at > best.updated_at) best = e;
  }
  return best;
}

/** Common App first, then by deadline (undated last), then name. */
export function sortSchools<T extends School>(schools: T[]): T[] {
  return [...schools].sort((a, b) => {
    if (Boolean(a.is_common_app) !== Boolean(b.is_common_app)) return a.is_common_app ? -1 : 1;
    if (a.deadline && b.deadline && a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
    if (Boolean(a.deadline) !== Boolean(b.deadline)) return a.deadline ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function useApplications(studentIds: string[]) {
  const { emit } = useBackend();
  const me = useMe();
  const ids = useMemo(() => [...new Set(studentIds.filter(Boolean))].sort(), [studentIds]);
  const key = `app:${ids.join(',')}`;

  const r = useResource<ApplicationData>(
    key,
    ids.length > 0,
    async (api) => {
      const [schools, essays] = await Promise.all([api.listSchools(ids), api.listEssays(ids)]);
      const [prompts, comments] = await Promise.all([
        api.listPrompts(schools.map((s) => s.id)),
        api.listComments(essays.map((e) => e.id)),
      ]);
      return { schools, prompts, essays, comments };
    },
    ['schools', 'prompts', 'essays', 'essay_comments'],
    EMPTY_APP,
  );
  const { api } = useBackend();
  const { setData, source } = r;

  const schoolsWithEssays: SchoolWithEssays[] = useMemo(() => {
    const { schools, prompts, essays, comments } = r.data;
    return sortSchools(schools).map((school) => ({
      ...school,
      prompts: prompts
        .filter((p) => p.school_id === school.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => {
          const essay = pickEssay(essays, p.id);
          return {
            ...p,
            essay,
            comments: essay ? comments.filter((c) => c.essay_id === essay.id) : [],
          };
        }),
    }));
  }, [r.data]);

  const announce = useCallback((tables: TableName[]) => emit(tables, source), [emit, source]);

  /* Schools */
  const addSchool = useCallback(
    async (studentId: string, school: NewSchool) => {
      const created = await api.createSchool(studentId, school);
      setData((d) => ({ ...d, schools: [...d.schools, created] }));
      announce(['schools']);
      return created;
    },
    [api, setData, announce],
  );

  const updateSchool = useCallback(
    async (id: string, updates: Partial<NewSchool>) => {
      const updated = await api.updateSchool(id, updates);
      setData((d) => ({ ...d, schools: d.schools.map((s) => (s.id === id ? updated : s)) }));
      announce(['schools']);
      return updated;
    },
    [api, setData, announce],
  );

  const deleteSchool = useCallback(
    async (id: string) => {
      await api.deleteSchool(id);
      setData((d) => {
        const promptIds = new Set(d.prompts.filter((p) => p.school_id === id).map((p) => p.id));
        const essayIds = new Set(d.essays.filter((e) => promptIds.has(e.prompt_id)).map((e) => e.id));
        return {
          schools: d.schools.filter((s) => s.id !== id),
          prompts: d.prompts.filter((p) => !promptIds.has(p.id)),
          essays: d.essays.filter((e) => !essayIds.has(e.id)),
          comments: d.comments.filter((c) => !essayIds.has(c.essay_id)),
        };
      });
      announce(['schools', 'prompts', 'essays', 'essay_comments']);
    },
    [api, setData, announce],
  );

  /* Prompts */
  const addPrompt = useCallback(
    async (prompt: NewPrompt) => {
      const created = await api.createPrompt(prompt);
      setData((d) => ({ ...d, prompts: [...d.prompts, created] }));
      announce(['prompts']);
      return created;
    },
    [api, setData, announce],
  );

  const updatePrompt = useCallback(
    async (id: string, updates: PromptUpdates) => {
      setData((d) => ({ ...d, prompts: d.prompts.map((p) => (p.id === id ? { ...p, ...updates } : p)) }));
      const updated = await api.updatePrompt(id, updates);
      announce(['prompts']);
      return updated;
    },
    [api, setData, announce],
  );

  const deletePrompt = useCallback(
    async (id: string) => {
      await api.deletePrompt(id);
      setData((d) => {
        const essayIds = new Set(d.essays.filter((e) => e.prompt_id === id).map((e) => e.id));
        return {
          ...d,
          prompts: d.prompts.filter((p) => p.id !== id),
          essays: d.essays.filter((e) => !essayIds.has(e.id)),
          comments: d.comments.filter((c) => !essayIds.has(c.essay_id)),
        };
      });
      announce(['prompts', 'essays', 'essay_comments']);
    },
    [api, setData, announce],
  );

  /* Essays */
  const ensureEssay = useCallback(
    async (promptId: string, studentId: string): Promise<Essay> => {
      const existing = pickEssay(r.data.essays, promptId);
      if (existing) return existing;
      const created = await api.createEssay({ prompt_id: promptId, student_id: studentId });
      setData((d) => ({ ...d, essays: [...d.essays, created] }));
      announce(['essays']);
      return created;
    },
    [api, r.data.essays, setData, announce],
  );

  const updateEssay = useCallback(
    async (id: string, updates: EssayUpdates) => {
      const updated = await api.updateEssay(id, updates);
      setData((d) => ({ ...d, essays: d.essays.map((e) => (e.id === id ? updated : e)) }));
      announce(['essays']);
      return updated;
    },
    [api, setData, announce],
  );

  const setEssayStatus = useCallback((id: string, status: EssayStatus) => updateEssay(id, { status }), [updateEssay]);

  /* Comments */
  const addComment = useCallback(
    async (essayId: string, content: string) => {
      const text = content.trim();
      if (!text) return null;
      if (!me) throw new Error('You are not signed in.');
      const created = await api.createComment({ essay_id: essayId, author_id: me.id, content: text });
      const withAuthor = created.author ? created : { ...created, author: me };
      setData((d) => ({ ...d, comments: [...d.comments, withAuthor] }));
      announce(['essay_comments']);
      return withAuthor;
    },
    [api, me, setData, announce],
  );

  return {
    ...r.data,
    schoolsWithEssays,
    loading: r.loading,
    error: r.error,
    reload: r.reload,
    addSchool,
    updateSchool,
    deleteSchool,
    addPrompt,
    updatePrompt,
    deletePrompt,
    ensureEssay,
    updateEssay,
    setEssayStatus,
    addComment,
  };
}

/** Version history for one essay (newest first). */
export function useEssayVersions(essayId: string | null | undefined) {
  const { api, emit } = useBackend();
  const r = useResource<EssayVersion[]>(
    `versions:${essayId}`,
    Boolean(essayId),
    (a) => a.listEssayVersions(essayId!),
    ['essay_versions'],
    [],
  );
  const { setData, source } = r;
  const snapshot = useCallback(
    async (content: string, wordCount: number) => {
      if (!essayId) return null;
      const created = await api.createEssayVersion({ essay_id: essayId, content, word_count: wordCount });
      setData((v) => [created, ...v]);
      emit(['essay_versions'], source);
      return created;
    },
    [api, essayId, setData, emit, source],
  );
  return { versions: r.data, loading: r.loading, error: r.error, snapshot };
}

/* --------------------------------------------------------------------------
   Tasks
   -------------------------------------------------------------------------- */
export const TASK_CATEGORIES = [
  'Essays',
  'Applications',
  'Testing',
  'Recommendations',
  'Activities',
  'Research',
  'Financial Aid',
  'General',
] as const;

export function useTasks(studentIds: string[]) {
  const { api, emit } = useBackend();
  const me = useMe();
  const ids = useMemo(() => [...new Set(studentIds.filter(Boolean))].sort(), [studentIds]);
  const r = useResource<Task[]>(`tasks:${ids.join(',')}`, ids.length > 0, (a) => a.listTasks(ids), ['tasks'], []);
  const { setData, source } = r;
  const announce = useCallback(() => emit(['tasks'], source), [emit, source]);

  const addTask = useCallback(
    async (input: { student_id: string; title: string; category: string; due_date: string | null }) => {
      if (!me) throw new Error('You are not signed in.');
      const title = input.title.trim();
      if (!title) throw new Error('Give the task a title.');
      const created = await api.createTask({ ...input, title, created_by: me.id });
      setData((t) => [...t, created]);
      announce();
      return created;
    },
    [api, me, setData, announce],
  );

  const updateTask = useCallback(
    async (id: string, updates: TaskUpdates) => {
      let previous: Task | undefined;
      setData((t) =>
        t.map((task) => {
          if (task.id !== id) return task;
          previous = task;
          return { ...task, ...updates } as Task;
        }),
      );
      try {
        const updated = await api.updateTask(id, updates);
        setData((t) => t.map((task) => (task.id === id ? updated : task)));
        announce();
        return updated;
      } catch (err) {
        if (previous) {
          const restore = previous;
          setData((t) => t.map((task) => (task.id === id ? restore : task)));
        }
        throw err;
      }
    },
    [api, setData, announce],
  );

  const toggleTask = useCallback(
    (task: Task) =>
      updateTask(task.id, {
        completed: !task.completed,
        completed_at: task.completed ? null : new Date().toISOString(),
      }),
    [updateTask],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await api.deleteTask(id);
      setData((t) => t.filter((task) => task.id !== id));
      announce();
    },
    [api, setData, announce],
  );

  return { tasks: r.data, loading: r.loading, error: r.error, reload: r.reload, addTask, updateTask, toggleTask, deleteTask };
}

/* --------------------------------------------------------------------------
   Activities (Common App style list, max 10)
   -------------------------------------------------------------------------- */
export const MAX_ACTIVITIES = 10;

export function useActivities(studentId: string | null | undefined) {
  const { api, emit } = useBackend();
  const r = useResource<Activity[]>(
    `activities:${studentId}`,
    Boolean(studentId),
    (a) => a.listActivities(studentId!),
    ['activities'],
    [],
  );
  const { setData, source } = r;
  const timers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; pending: ActivityUpdates }>());
  const [saving, setSaving] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const announce = useCallback(() => emit(['activities'], source), [emit, source]);

  const flush = useCallback(
    async (id: string) => {
      const entry = timers.current.get(id);
      if (!entry) return;
      clearTimeout(entry.timer);
      timers.current.delete(id);
      setSaving((n) => n + 1);
      try {
        await api.updateActivity(id, entry.pending);
        setSaveError(null);
        announce();
      } catch (err) {
        setSaveError(errorMessage(err));
      } finally {
        setSaving((n) => n - 1);
      }
    },
    [api, announce],
  );

  // Save anything pending when leaving the screen.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((entry, id) => {
        clearTimeout(entry.timer);
        api.updateActivity(id, entry.pending).catch(() => {});
      });
      map.clear();
    };
  }, [api]);

  /** Optimistic edit; persisted after a short pause in typing. */
  const updateActivity = useCallback(
    (id: string, updates: ActivityUpdates) => {
      setData((list) => list.map((a) => (a.id === id ? { ...a, ...updates } : a)));
      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing.timer);
      const pending = { ...(existing?.pending ?? {}), ...updates };
      const timer = setTimeout(() => void flush(id), 700);
      timers.current.set(id, { timer, pending });
    },
    [setData, flush],
  );

  const addActivity = useCallback(async () => {
    if (!studentId) return null;
    if (r.data.length >= MAX_ACTIVITIES) throw new Error(`The Common App allows ${MAX_ACTIVITIES} activities.`);
    const created = await api.createActivity({
      student_id: studentId,
      position_order: r.data.length + 1,
      activity_name: 'New activity',
      activity_type: 'Other Club/Activity',
      role: '',
      organization: '',
      grade_levels: '',
      timing: '',
      hours_per_week: 0,
      weeks_per_year: 0,
      description: '',
    });
    setData((list) => [...list, created]);
    announce();
    return created;
  }, [api, studentId, r.data.length, setData, announce]);

  const persistOrder = useCallback(
    async (list: Activity[]) => {
      const changed = list.filter((a, i) => a.position_order !== i + 1);
      const renumbered = list.map((a, i) => ({ ...a, position_order: i + 1 }));
      setData(renumbered);
      try {
        await Promise.all(changed.map((a) => api.updateActivity(a.id, { position_order: renumbered.findIndex((x) => x.id === a.id) + 1 })));
        announce();
      } catch (err) {
        setSaveError(errorMessage(err));
      }
    },
    [api, setData, announce],
  );

  const deleteActivity = useCallback(
    async (id: string) => {
      const entry = timers.current.get(id);
      if (entry) {
        clearTimeout(entry.timer);
        timers.current.delete(id);
      }
      await api.deleteActivity(id);
      await persistOrder(r.data.filter((a) => a.id !== id));
    },
    [api, r.data, persistOrder],
  );

  const moveActivity = useCallback(
    (from: number, to: number) => {
      if (from === to || to < 0 || to >= r.data.length) return;
      const list = [...r.data];
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      void persistOrder(list);
    },
    [r.data, persistOrder],
  );

  return {
    activities: r.data,
    loading: r.loading,
    error: r.error,
    saving: saving > 0,
    saveError,
    addActivity,
    updateActivity,
    deleteActivity,
    moveActivity,
  };
}

/* --------------------------------------------------------------------------
   Messaging
   -------------------------------------------------------------------------- */
interface MessagingData {
  conversations: Conversation[];
  messages: Message[];
  people: Profile[];
}

/**
 * Students: pass null to load the signed-in student's own conversation(s).
 * Counselors: pass the student ids whose threads should be loaded.
 */
export function useMessaging(studentIds: string[] | null) {
  const { api, emit } = useBackend();
  const me = useMe();
  const ids = useMemo(() => (studentIds ? [...new Set(studentIds)].sort() : null), [studentIds]);
  const key = ids ? `msg:students:${ids.join(',')}` : `msg:me:${me?.id}`;

  const r = useResource<MessagingData>(
    key,
    ids ? ids.length > 0 : Boolean(me),
    async (a) => {
      const conversations = ids ? await a.listConversationsForStudents(ids) : await a.listConversationsForUser(me!.id);
      const messages = await a.listMessages(conversations.map((c) => c.id));
      const personIds = new Set<string>();
      conversations.forEach((c) => {
        personIds.add(c.student_id);
        personIds.add(c.consultant_id);
      });
      messages.forEach((m) => personIds.add(m.sender_id));
      const people = await a.listProfiles([...personIds]);
      return { conversations, messages, people };
    },
    ['conversations', 'messages'],
    { conversations: [], messages: [], people: [] },
  );
  const { setData, source } = r;

  const conversationIds = useMemo(() => r.data.conversations.map((c) => c.id).sort().join(','), [r.data.conversations]);

  // Live updates for loaded conversations.
  useEffect(() => {
    if (!conversationIds) return;
    return api.subscribeToMessages(conversationIds.split(','), (message) => {
      setData((d) => (d.messages.some((m) => m.id === message.id) ? d : { ...d, messages: [...d.messages, message] }));
    });
  }, [api, conversationIds, setData]);

  const peopleById = useMemo(() => {
    const map: Record<string, Profile> = {};
    r.data.people.forEach((p) => (map[p.id] = p));
    r.data.messages.forEach((m) => {
      if (m.sender && !map[m.sender_id]) map[m.sender_id] = m.sender;
    });
    if (me) map[me.id] = me;
    return map;
  }, [r.data.people, r.data.messages, me]);

  const send = useCallback(
    async (conversationId: string, content: string) => {
      const text = content.trim();
      if (!text) return null;
      if (!me) throw new Error('You are not signed in.');
      const sent = await api.sendMessage({ conversation_id: conversationId, sender_id: me.id, content: text });
      setData((d) => (d.messages.some((m) => m.id === sent.id) ? d : { ...d, messages: [...d.messages, sent] }));
      emit(['messages'], source);
      return sent;
    },
    [api, me, setData, emit, source],
  );

  /** Counselor: open (or create) the thread with a student. */
  const startConversation = useCallback(
    async (studentId: string) => {
      if (!me) throw new Error('You are not signed in.');
      const existing =
        r.data.conversations.find((c) => c.student_id === studentId && c.consultant_id === me.id) ??
        r.data.conversations.find((c) => c.student_id === studentId);
      if (existing) return existing;
      const created = await api.createConversation({ student_id: studentId, consultant_id: me.id });
      setData((d) => ({ ...d, conversations: [...d.conversations, created] }));
      emit(['conversations'], source);
      return created;
    },
    [api, me, r.data.conversations, setData, emit, source],
  );

  return {
    conversations: r.data.conversations,
    messages: r.data.messages,
    peopleById,
    loading: r.loading,
    error: r.error,
    send,
    startConversation,
  };
}

/* --------------------------------------------------------------------------
   Files
   -------------------------------------------------------------------------- */
export const FILE_FOLDERS = ['Essays', 'Documents', 'Worksheets', 'Research', 'General'] as const;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function useFiles(studentIds: string[]) {
  const { api, emit } = useBackend();
  const me = useMe();
  const ids = useMemo(() => [...new Set(studentIds.filter(Boolean))].sort(), [studentIds]);
  const r = useResource<SharedFile[]>(`files:${ids.join(',')}`, ids.length > 0, (a) => a.listFiles(ids), ['files'], []);
  const { setData, source } = r;

  const upload = useCallback(
    async (studentId: string, folder: string, file: File) => {
      if (!me) throw new Error('You are not signed in.');
      if (file.size > MAX_UPLOAD_BYTES) throw new Error('Files must be 25 MB or smaller.');
      const created = await api.uploadFile({ student_id: studentId, uploaded_by: me.id, folder, file });
      setData((f) => [created, ...f]);
      emit(['files'], source);
      return created;
    },
    [api, me, setData, emit, source],
  );

  const remove = useCallback(
    async (file: SharedFile) => {
      await api.deleteFile(file);
      setData((f) => f.filter((x) => x.id !== file.id));
      emit(['files'], source);
    },
    [api, setData, emit, source],
  );

  const open = useCallback(
    async (file: SharedFile) => {
      // Open the tab synchronously so popup blockers allow it, then point it at the signed URL.
      const tab = window.open('', '_blank');
      try {
        const url = await api.getFileUrl(file);
        if (tab) tab.location.href = url;
        else window.location.href = url;
      } catch (err) {
        tab?.close();
        throw err;
      }
    },
    [api],
  );

  return { files: r.data, loading: r.loading, error: r.error, upload, remove, open };
}

export type ApplicationsApi = ReturnType<typeof useApplications>;
export type TasksApi = ReturnType<typeof useTasks>;
export type MessagingApi = ReturnType<typeof useMessaging>;
export type FilesApi = ReturnType<typeof useFiles>;
