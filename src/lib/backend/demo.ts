/* ==========================================================================
   In-memory demo backend
   Implements the full PortalBackend contract against a private copy of the
   sample dataset. Nothing leaves the browser and everything resets on reload.
   ========================================================================== */

import type {
  Activity,
  Conversation,
  Essay,
  EssayComment,
  EssayVersion,
  Message,
  Profile,
  Prompt,
  School,
  SharedFile,
  Task,
} from '@/types/database';
import { createDemoDb, DEMO_COUNSELOR_ID, type DemoDb } from './demo-data';
import type {
  ActivityUpdates,
  EssayUpdates,
  NewActivity,
  NewPrompt,
  NewSchool,
  NewTask,
  PortalBackend,
  PromptUpdates,
  TaskUpdates,
} from './types';

const LATENCY_MS = 120;
const AUTO_REPLY_DELAY_MS = 2500;
const AUTO_REPLY_TEXT = 'Got it, thanks! (This is the demo portal, so replies here come from a sample counselor.)';
const SAMPLE_FILE_TEXT = 'This is a sample file in the DeltaX demo portal.';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type MessageListener = { conversationIds: Set<string>; onInsert: (message: Message) => void };

/* Helpers ----------------------------------------------------------------- */

function delay<T>(produce: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(structuredClone(produce()));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }, LATENCY_MS);
  });
}

function now(): string {
  return new Date().toISOString();
}

/** Ascending by a YYYY-MM-DD string, empty or null values last. */
function byDateAsc(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function byTimeAsc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function findOrThrow<T extends { id: string }>(rows: T[], id: string, label: string): T {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`${label} not found.`);
  return row;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/* Backend ----------------------------------------------------------------- */

export function createDemoBackend(): PortalBackend {
  const db: DemoDb = createDemoDb();
  let counter = 0;
  const nextId = (kind: string) => `demo-${kind}-${++counter}`;

  const fileUrls = new Map<string, string>();
  const messageListeners = new Set<MessageListener>();
  const autoReplied = new Set<string>();

  const profileById = (id: string): Profile | undefined => db.profiles.find((p) => p.id === id);

  const withAuthor = (comment: EssayComment): EssayComment => {
    const author = profileById(comment.author_id);
    return author ? { ...comment, author } : { ...comment };
  };

  const withSender = (message: Message): Message => {
    const sender = profileById(message.sender_id);
    return sender ? { ...message, sender } : { ...message };
  };

  const removeEssays = (essayIds: Set<string>) => {
    db.essays = db.essays.filter((e) => !essayIds.has(e.id));
    db.essay_comments = db.essay_comments.filter((c) => !essayIds.has(c.essay_id));
    db.essay_versions = db.essay_versions.filter((v) => !essayIds.has(v.essay_id));
  };

  const removePrompts = (promptIds: Set<string>) => {
    const essayIds = new Set(db.essays.filter((e) => promptIds.has(e.prompt_id)).map((e) => e.id));
    db.prompts = db.prompts.filter((p) => !promptIds.has(p.id));
    removeEssays(essayIds);
  };

  const insertMessage = (input: { conversation_id: string; sender_id: string; content: string }): Message => {
    const message: Message = {
      id: nextId('message'),
      conversation_id: input.conversation_id,
      sender_id: input.sender_id,
      content: input.content,
      file_url: null,
      created_at: now(),
    };
    db.messages.push(message);
    return message;
  };

  const notify = (message: Message) => {
    const joined = withSender(message);
    messageListeners.forEach((listener) => {
      if (!listener.conversationIds.has(message.conversation_id)) return;
      try {
        listener.onInsert(structuredClone(joined));
      } catch (err) {
        console.error('Demo message listener failed', err);
      }
    });
  };

  const scheduleAutoReply = (conversation: Conversation) => {
    if (autoReplied.has(conversation.id)) return;
    autoReplied.add(conversation.id);
    setTimeout(() => {
      if (!db.conversations.some((c) => c.id === conversation.id)) return;
      const reply = insertMessage({
        conversation_id: conversation.id,
        sender_id: conversation.consultant_id,
        content: AUTO_REPLY_TEXT,
      });
      notify(reply);
    }, AUTO_REPLY_DELAY_MS);
  };

  const backend: PortalBackend = {
    kind: 'demo',

    /* People -------------------------------------------------------------- */

    getProfile: (id) => delay(() => profileById(id) ?? null),

    listStudents: () =>
      delay(() =>
        db.profiles.filter((p) => p.role === 'student').sort((a, b) => a.full_name.localeCompare(b.full_name)),
      ),

    listConsultants: () =>
      delay(() =>
        db.profiles.filter((p) => p.role === 'consultant').sort((a, b) => a.full_name.localeCompare(b.full_name)),
      ),

    listProfiles: (ids) =>
      delay(() => {
        const wanted = new Set(ids);
        return db.profiles.filter((p) => wanted.has(p.id));
      }),

    updateProfile: (id, updates) =>
      delay(() => {
        const profile = findOrThrow(db.profiles, id, 'Profile');
        const fullName = updates.full_name.trim();
        if (!fullName) throw new Error('Please enter your name.');
        profile.full_name = fullName;
        profile.avatar_initials = updates.avatar_initials.trim().toUpperCase().slice(0, 3) || initialsFor(fullName);
        return profile;
      }),

    updatePassword: (password) =>
      delay(() => {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      }),

    createStudent: (input) =>
      delay(() => {
        const fullName = input.fullName.trim();
        const email = input.email.trim().toLowerCase();
        if (!fullName) throw new Error('Please enter the student\'s full name.');
        if (!EMAIL_PATTERN.test(email)) throw new Error('Please enter a valid email address.');
        if (input.password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (db.profiles.some((p) => p.email.toLowerCase() === email)) {
          throw new Error('An account with that email already exists.');
        }
        const profile: Profile = {
          id: nextId('student'),
          role: 'student',
          full_name: fullName,
          assigned_consultant_id: DEMO_COUNSELOR_ID,
          avatar_initials: initialsFor(fullName),
          email,
          created_at: now(),
        };
        db.profiles.push(profile);
        db.conversations.push({ id: nextId('conversation'), student_id: profile.id, consultant_id: DEMO_COUNSELOR_ID });
        return { userId: profile.id };
      }),

    /* Schools ------------------------------------------------------------- */

    listSchools: (studentIds) =>
      delay(() => {
        const wanted = new Set(studentIds);
        return db.schools.filter((s) => wanted.has(s.student_id)).sort((a, b) => byDateAsc(a.deadline, b.deadline));
      }),

    createSchool: (studentId, school: NewSchool) =>
      delay(() => {
        if (!school.name.trim()) throw new Error('Please enter a school name.');
        const row: School = {
          id: nextId('school'),
          student_id: studentId,
          name: school.name.trim(),
          program: school.program,
          category: school.category,
          decision_plan: school.decision_plan,
          deadline: school.deadline,
          notes: school.notes,
          created_at: now(),
          is_common_app: school.is_common_app ?? false,
        };
        db.schools.push(row);
        return row;
      }),

    updateSchool: (id, updates) =>
      delay(() => {
        const school = findOrThrow(db.schools, id, 'School');
        Object.assign(school, updates);
        return school;
      }),

    deleteSchool: (id) =>
      delay(() => {
        findOrThrow(db.schools, id, 'School');
        const promptIds = new Set(db.prompts.filter((p) => p.school_id === id).map((p) => p.id));
        removePrompts(promptIds);
        db.schools = db.schools.filter((s) => s.id !== id);
      }),

    /* Prompts ------------------------------------------------------------- */

    listPrompts: (schoolIds) =>
      delay(() => {
        const wanted = new Set(schoolIds);
        return db.prompts.filter((p) => wanted.has(p.school_id)).sort((a, b) => a.sort_order - b.sort_order);
      }),

    createPrompt: (prompt: NewPrompt) =>
      delay(() => {
        findOrThrow(db.schools, prompt.school_id, 'School');
        const row: Prompt = { ...prompt, id: nextId('prompt') };
        db.prompts.push(row);
        return row;
      }),

    updatePrompt: (id, updates: PromptUpdates) =>
      delay(() => {
        const prompt = findOrThrow(db.prompts, id, 'Prompt');
        Object.assign(prompt, updates);
        return prompt;
      }),

    deletePrompt: (id) =>
      delay(() => {
        findOrThrow(db.prompts, id, 'Prompt');
        removePrompts(new Set([id]));
      }),

    /* Essays -------------------------------------------------------------- */

    listEssays: (studentIds) =>
      delay(() => {
        const wanted = new Set(studentIds);
        return db.essays.filter((e) => wanted.has(e.student_id));
      }),

    createEssay: (input) =>
      delay(() => {
        const existing = db.essays.find((e) => e.prompt_id === input.prompt_id && e.student_id === input.student_id);
        if (existing) return existing;
        findOrThrow(db.prompts, input.prompt_id, 'Prompt');
        const row: Essay = {
          id: nextId('essay'),
          prompt_id: input.prompt_id,
          student_id: input.student_id,
          content: input.content ?? '',
          status: 'not_started',
          word_count: input.word_count ?? 0,
          updated_at: now(),
        };
        db.essays.push(row);
        return row;
      }),

    updateEssay: (id, updates: EssayUpdates) =>
      delay(() => {
        const essay = findOrThrow(db.essays, id, 'Essay');
        Object.assign(essay, updates, { updated_at: now() });
        return essay;
      }),

    listEssayVersions: (essayId) =>
      delay(() =>
        db.essay_versions.filter((v) => v.essay_id === essayId).sort((a, b) => byTimeAsc(b.created_at, a.created_at)),
      ),

    createEssayVersion: (input) =>
      delay(() => {
        findOrThrow(db.essays, input.essay_id, 'Essay');
        const row: EssayVersion = { id: nextId('version'), ...input, created_at: now() };
        db.essay_versions.push(row);
        return row;
      }),

    listComments: (essayIds) =>
      delay(() => {
        const wanted = new Set(essayIds);
        return db.essay_comments
          .filter((c) => wanted.has(c.essay_id))
          .sort((a, b) => byTimeAsc(a.created_at, b.created_at))
          .map(withAuthor);
      }),

    createComment: (input) =>
      delay(() => {
        findOrThrow(db.essays, input.essay_id, 'Essay');
        const content = input.content.trim();
        if (!content) throw new Error('Comment cannot be empty.');
        const row: EssayComment = {
          id: nextId('comment'),
          essay_id: input.essay_id,
          author_id: input.author_id,
          content,
          created_at: now(),
        };
        db.essay_comments.push(row);
        return withAuthor(row);
      }),

    /* Tasks --------------------------------------------------------------- */

    listTasks: (studentIds) =>
      delay(() => {
        const wanted = new Set(studentIds);
        return db.tasks.filter((t) => wanted.has(t.student_id)).sort((a, b) => byDateAsc(a.due_date, b.due_date));
      }),

    createTask: (task: NewTask) =>
      delay(() => {
        if (!task.title.trim()) throw new Error('Please enter a task title.');
        const row: Task = {
          id: nextId('task'),
          student_id: task.student_id,
          created_by: task.created_by,
          title: task.title.trim(),
          category: task.category,
          due_date: task.due_date ?? '',
          completed: false,
          completed_at: null,
        };
        db.tasks.push(row);
        return row;
      }),

    updateTask: (id, updates: TaskUpdates) =>
      delay(() => {
        const task = findOrThrow(db.tasks, id, 'Task');
        const { due_date, ...rest } = updates;
        Object.assign(task, rest);
        if (due_date !== undefined) task.due_date = due_date ?? '';
        return task;
      }),

    deleteTask: (id) =>
      delay(() => {
        findOrThrow(db.tasks, id, 'Task');
        db.tasks = db.tasks.filter((t) => t.id !== id);
      }),

    /* Activities ---------------------------------------------------------- */

    listActivities: (studentId) =>
      delay(() =>
        db.activities.filter((a) => a.student_id === studentId).sort((a, b) => a.position_order - b.position_order),
      ),

    createActivity: (activity: NewActivity) =>
      delay(() => {
        const row: Activity = { ...activity, id: nextId('activity') };
        db.activities.push(row);
        return row;
      }),

    updateActivity: (id, updates: ActivityUpdates) =>
      delay(() => {
        const activity = findOrThrow(db.activities, id, 'Activity');
        Object.assign(activity, updates);
      }),

    deleteActivity: (id) =>
      delay(() => {
        findOrThrow(db.activities, id, 'Activity');
        db.activities = db.activities.filter((a) => a.id !== id);
      }),

    /* Messaging ----------------------------------------------------------- */

    listConversationsForUser: (userId) =>
      delay(() => db.conversations.filter((c) => c.student_id === userId || c.consultant_id === userId)),

    listConversationsForStudents: (studentIds) =>
      delay(() => {
        const wanted = new Set(studentIds);
        return db.conversations.filter((c) => wanted.has(c.student_id));
      }),

    createConversation: (input) =>
      delay(() => {
        const existing = db.conversations.find(
          (c) => c.student_id === input.student_id && c.consultant_id === input.consultant_id,
        );
        if (existing) return existing;
        const row: Conversation = { id: nextId('conversation'), ...input };
        db.conversations.push(row);
        return row;
      }),

    listMessages: (conversationIds) =>
      delay(() => {
        const wanted = new Set(conversationIds);
        return db.messages
          .filter((m) => wanted.has(m.conversation_id))
          .sort((a, b) => byTimeAsc(a.created_at, b.created_at))
          .map(withSender);
      }),

    sendMessage: (input) =>
      delay(() => {
        const conversation = findOrThrow(db.conversations, input.conversation_id, 'Conversation');
        const content = input.content.trim();
        if (!content) throw new Error('Message cannot be empty.');
        const message = insertMessage({ ...input, content });
        // Deliver after the sender's promise resolves, like a realtime insert would.
        setTimeout(() => notify(message), 0);
        if (profileById(input.sender_id)?.role !== 'consultant') scheduleAutoReply(conversation);
        return withSender(message);
      }),

    subscribeToMessages: (conversationIds, onInsert) => {
      const listener: MessageListener = { conversationIds: new Set(conversationIds), onInsert };
      messageListeners.add(listener);
      return () => {
        messageListeners.delete(listener);
      };
    },

    /* Files --------------------------------------------------------------- */

    listFiles: (studentIds) =>
      delay(() => {
        const wanted = new Set(studentIds);
        return db.files
          .filter((f) => wanted.has(f.student_id))
          .sort((a, b) => byTimeAsc(b.created_at, a.created_at));
      }),

    uploadFile: (input) =>
      delay(() => {
        const id = nextId('file');
        const row: SharedFile = {
          id,
          uploaded_by: input.uploaded_by,
          student_id: input.student_id,
          name: input.file.name,
          storage_path: `demo/${id}`,
          folder: input.folder,
          size_bytes: input.file.size,
          created_at: now(),
        };
        fileUrls.set(id, URL.createObjectURL(input.file));
        db.files.push(row);
        return row;
      }),

    getFileUrl: (file) =>
      delay(() => {
        const stored = fileUrls.get(file.id);
        if (stored) return stored;
        const url = URL.createObjectURL(new Blob([SAMPLE_FILE_TEXT], { type: 'text/plain' }));
        fileUrls.set(file.id, url);
        return url;
      }),

    deleteFile: (file) =>
      delay(() => {
        findOrThrow(db.files, file.id, 'File');
        db.files = db.files.filter((f) => f.id !== file.id);
        const url = fileUrls.get(file.id);
        if (url) {
          URL.revokeObjectURL(url);
          fileUrls.delete(file.id);
        }
      }),
  };

  return backend;
}
