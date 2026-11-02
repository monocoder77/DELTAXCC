/* ==========================================================================
   Portal backend contract
   Every read and write the portal makes goes through this interface.
   Two implementations: Supabase (production) and an in-memory demo.
   Methods throw an Error with a user-readable message on failure.
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
export type NewSchool = Pick<School, 'name' | 'program' | 'category' | 'decision_plan' | 'notes'> & {
  /** YYYY-MM-DD or '' for no deadline */
  deadline: string;
  is_common_app?: boolean;
};

export type NewPrompt = Omit<Prompt, 'id'>;
export type PromptUpdates = Partial<Pick<Prompt, 'title' | 'prompt_text' | 'word_limit' | 'sort_order'>>;
export type EssayUpdates = Partial<Pick<Essay, 'content' | 'status' | 'word_count'>>;
export type NewTask = Pick<Task, 'student_id' | 'created_by' | 'title' | 'category'> & { due_date: string | null };
export type TaskUpdates = Partial<Pick<Task, 'title' | 'category' | 'completed' | 'completed_at'>> & { due_date?: string | null };
export type NewActivity = Omit<Activity, 'id'>;
export type ActivityUpdates = Partial<Omit<Activity, 'id' | 'student_id'>>;

/** Tables a mutation can touch. Hooks use these to refresh each other. */
export type TableName =
  | 'profiles'
  | 'schools'
  | 'prompts'
  | 'essays'
  | 'essay_versions'
  | 'essay_comments'
  | 'tasks'
  | 'activities'
  | 'conversations'
  | 'messages'
  | 'files';

export interface PortalBackend {
  readonly kind: 'supabase' | 'demo';

  /* People ---------------------------------------------------------------- */
  getProfile(id: string): Promise<Profile | null>;
  /** All student profiles visible to the caller, ordered by full_name. */
  listStudents(): Promise<Profile[]>;
  /** All counselor (role 'consultant') profiles visible to the caller, ordered by full_name. */
  listConsultants(): Promise<Profile[]>;
  /** Profiles by id (for comment authors / message senders). Missing ids are simply omitted. */
  listProfiles(ids: string[]): Promise<Profile[]>;
  updateProfile(id: string, updates: { full_name: string; avatar_initials: string }): Promise<Profile>;
  updatePassword(password: string): Promise<void>;
  /** Counselor-only: create a student account assigned to the calling counselor. */
  createStudent(input: { fullName: string; email: string; password: string }): Promise<{ userId: string }>;

  /* Schools --------------------------------------------------------------- */
  /** Ordered by deadline ascending, schools without a deadline last. */
  listSchools(studentIds: string[]): Promise<School[]>;
  createSchool(studentId: string, school: NewSchool): Promise<School>;
  updateSchool(id: string, updates: Partial<NewSchool>): Promise<School>;
  /** Cascades to prompts, essays, comments in the database. */
  deleteSchool(id: string): Promise<void>;

  /* Prompts --------------------------------------------------------------- */
  /** Ordered by sort_order. */
  listPrompts(schoolIds: string[]): Promise<Prompt[]>;
  createPrompt(prompt: NewPrompt): Promise<Prompt>;
  updatePrompt(id: string, updates: PromptUpdates): Promise<Prompt>;
  /** Cascades to the essay and its comments. */
  deletePrompt(id: string): Promise<void>;

  /* Essays ---------------------------------------------------------------- */
  listEssays(studentIds: string[]): Promise<Essay[]>;
  createEssay(input: { prompt_id: string; student_id: string; content?: string; word_count?: number }): Promise<Essay>;
  /** Also sets updated_at = now. */
  updateEssay(id: string, updates: EssayUpdates): Promise<Essay>;
  /** Newest first. */
  listEssayVersions(essayId: string): Promise<EssayVersion[]>;
  createEssayVersion(input: { essay_id: string; content: string; word_count: number }): Promise<EssayVersion>;
  /** Oldest first, each with `author` joined when visible. */
  listComments(essayIds: string[]): Promise<EssayComment[]>;
  createComment(input: { essay_id: string; author_id: string; content: string }): Promise<EssayComment>;

  /* Tasks ----------------------------------------------------------------- */
  /** Ordered by due_date ascending, undated last. */
  listTasks(studentIds: string[]): Promise<Task[]>;
  createTask(task: NewTask): Promise<Task>;
  updateTask(id: string, updates: TaskUpdates): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  /* Activities ------------------------------------------------------------ */
  /** Ordered by position_order. */
  listActivities(studentId: string): Promise<Activity[]>;
  createActivity(activity: NewActivity): Promise<Activity>;
  updateActivity(id: string, updates: ActivityUpdates): Promise<void>;
  deleteActivity(id: string): Promise<void>;

  /* Messaging ------------------------------------------------------------- */
  /** Conversations where the user is the student or the counselor. */
  listConversationsForUser(userId: string): Promise<Conversation[]>;
  /** Conversations for these students (any counselor). */
  listConversationsForStudents(studentIds: string[]): Promise<Conversation[]>;
  createConversation(input: { student_id: string; consultant_id: string }): Promise<Conversation>;
  /** Oldest first, each with `sender` joined when visible. */
  listMessages(conversationIds: string[]): Promise<Message[]>;
  sendMessage(input: { conversation_id: string; sender_id: string; content: string }): Promise<Message>;
  /** Live inserts for these conversations. Returns an unsubscribe function. */
  subscribeToMessages(conversationIds: string[], onInsert: (message: Message) => void): () => void;

  /* Files ----------------------------------------------------------------- */
  /** Newest first. */
  listFiles(studentIds: string[]): Promise<SharedFile[]>;
  uploadFile(input: { student_id: string; uploaded_by: string; folder: string; file: File }): Promise<SharedFile>;
  /** Short-lived URL to open or download the file. */
  getFileUrl(file: SharedFile): Promise<string>;
  deleteFile(file: SharedFile): Promise<void>;
}
