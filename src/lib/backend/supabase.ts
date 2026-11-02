/* ==========================================================================
   Supabase implementation of the portal backend contract.
   Every method throws an Error with a human-readable message on failure.
   ========================================================================== */

import { getSupabase } from '@/lib/supabase';
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
import type { PortalBackend } from './types';

/* Errors ------------------------------------------------------------------ */

const NEEDS_MIGRATION = "Your account doesn't have permission to do this yet. Ask DeltaX to run the portal database update.";
const STORAGE_MISSING = "File storage isn't set up yet. Ask DeltaX to run the portal database update.";
const BUCKET = 'student-files';
const IN_CHUNK = 100;

interface ErrorLike {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/** Turn a Supabase / PostgREST / Storage / Auth error into a sentence a person can act on. */
function friendlyMessage(error: ErrorLike | null | undefined, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback;
  const code = error.code ?? '';
  const message = (error.message ?? '').trim();
  const lower = message.toLowerCase();

  if (code === '42501' || code === '42P17' || lower.includes('row-level security') || lower.includes('permission denied')) {
    return NEEDS_MIGRATION;
  }
  if (lower.includes('bucket not found')) return STORAGE_MISSING;
  if (code === 'PGRST116') {
    return "That item couldn't be found. It may have been removed, or your account may not have access to it.";
  }
  if (code === '23505') return 'That already exists.';
  if (code === '23503') return 'This refers to something that no longer exists. Refresh and try again.';
  if (code === '23514' || code === '22P02' || code === '22007' || code === '22008') {
    return 'Some of the values entered are not valid. Check them and try again.';
  }
  if (code === 'PGRST301' || lower.includes('jwt expired') || lower.includes('invalid jwt')) {
    return 'Your session has expired. Sign in again to continue.';
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed')) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return message || fallback;
}

function fail(error: ErrorLike | null | undefined, fallback?: string): never {
  throw new Error(friendlyMessage(error, fallback));
}

/** Throws on error, otherwise returns data (treating null as an empty list). */
function rows<T>(result: { data: unknown; error: ErrorLike | null }): T[] {
  if (result.error) fail(result.error);
  return (result.data as T[] | null) ?? [];
}

const UPDATE_BLOCKED =
  "That item couldn't be updated. It may have been removed, or your account may not have permission to change it yet. Ask DeltaX to run the portal database update if this keeps happening.";

/**
 * Throws on error or a missing row (used after insert/update .select().single()).
 * `noRow` replaces the generic PGRST116 message: an UPDATE that RLS filters out
 * matches zero rows and surfaces as PGRST116, not as a permission error.
 */
function row<T>(result: { data: unknown; error: ErrorLike | null }, noRow?: string): T {
  if (result.error?.code === 'PGRST116' && noRow) throw new Error(noRow);
  if (result.error) fail(result.error);
  if (result.data == null) fail(null, "That item couldn't be saved. Please try again.");
  return result.data as T;
}

/** Throws when a delete/update matched no rows (RLS silently filters them). */
function ensureAffected(result: { data: unknown; error: ErrorLike | null }, verb: 'change' | 'delete'): void {
  const affected = rows<unknown>(result);
  if (affected.length === 0) {
    throw new Error(
      verb === 'delete'
        ? "That item couldn't be deleted. It may already be gone, or your account may not have permission to delete it."
        : "That item couldn't be updated. It may have been removed, or your account may not have permission to change it.",
    );
  }
}

/* Helpers ----------------------------------------------------------------- */

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.length > 0)));
}

function chunk<T>(list: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Run a query once per batch of ids (keeps .in() URLs short) and merge the rows.
 * An empty id list returns [] without a request.
 */
async function inBatches<T>(
  ids: string[],
  query: (batch: string[]) => PromiseLike<{ data: unknown; error: ErrorLike | null }>,
): Promise<T[]> {
  const clean = uniqueIds(ids);
  if (clean.length === 0) return [];
  const results = await Promise.all(chunk(clean).map((batch) => query(batch)));
  return results.flatMap((result) => rows<T>(result));
}

type Comparator<T> = (a: T, b: T) => number;

/** Ascending by a nullable string key, nulls / empty last. */
function ascNullsLast<T>(key: (item: T) => string | null | undefined): Comparator<T> {
  return (a, b) => {
    const x = key(a) || null;
    const y = key(b) || null;
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return x < y ? -1 : 1;
  };
}

function byNumber<T>(key: (item: T) => number | null | undefined): Comparator<T> {
  return (a, b) => (key(a) ?? 0) - (key(b) ?? 0);
}

function desc<T>(compare: Comparator<T>): Comparator<T> {
  return (a, b) => compare(b, a);
}

/** Merged batches lose the server ordering, so re-sort in memory (stable). */
function sorted<T>(list: T[], compare: Comparator<T>): T[] {
  return [...list].sort(compare);
}

/** Embedded joins come back as null when RLS hides the profile; the contract uses undefined. */
function withAuthor(comment: EssayComment & { author?: Profile | null }): EssayComment {
  const { author, ...rest } = comment;
  return author ? { ...rest, author } : rest;
}

function withSender(message: Message & { sender?: Profile | null }): Message {
  const { sender, ...rest } = message;
  return sender ? { ...rest, sender } : rest;
}

function emptyToNull(value: string | null | undefined): string | null {
  return value && value.trim() ? value : null;
}

function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+/, '')
    .slice(-120);
  return cleaned || 'file';
}

let channelCounter = 0;

/* Backend ----------------------------------------------------------------- */

export function createSupabaseBackend(): PortalBackend {
  const db = () => getSupabase();

  return {
    kind: 'supabase',

    /* People -------------------------------------------------------------- */

    async getProfile(id) {
      if (!id) return null;
      const result = await db().from('profiles').select('*').eq('id', id).maybeSingle();
      if (result.error) fail(result.error);
      return (result.data as Profile | null) ?? null;
    },

    async listStudents() {
      return rows<Profile>(
        await db().from('profiles').select('*').eq('role', 'student').order('full_name', { ascending: true }),
      );
    },

    async listConsultants() {
      return rows<Profile>(
        await db().from('profiles').select('*').eq('role', 'consultant').order('full_name', { ascending: true }),
      );
    },

    async listProfiles(ids) {
      return inBatches<Profile>(ids, (batch) => db().from('profiles').select('*').in('id', batch));
    },

    async updateProfile(id, updates) {
      return row<Profile>(
        await db()
          .from('profiles')
          .update({ full_name: updates.full_name, avatar_initials: updates.avatar_initials })
          .eq('id', id)
          .select()
          .single(),
        UPDATE_BLOCKED,
      );
    },

    async updatePassword(password) {
      const { error } = await db().auth.updateUser({ password });
      if (error) fail(error);
    },

    async createStudent(input) {
      let response: Response;
      try {
        response = await fetch('/api/create-student', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ fullName: input.fullName, email: input.email, password: input.password }),
        });
      } catch {
        throw new Error('Could not reach the server. Check your connection and try again.');
      }
      let data: { error?: unknown; userId?: unknown } = {};
      try {
        const parsed: unknown = await response.json();
        if (parsed && typeof parsed === 'object') data = parsed as typeof data;
      } catch {
        // Non-JSON body (e.g. an HTML error page); fall through to the generic message.
      }
      if (!response.ok) {
        throw new Error(
          typeof data.error === 'string' && data.error ? data.error : `Could not create the student account (error ${response.status}).`,
        );
      }
      if (typeof data.userId !== 'string' || !data.userId) {
        throw new Error('The student account was created, but the server response was incomplete. Refresh to see it.');
      }
      return { userId: data.userId };
    },

    /* Schools ------------------------------------------------------------- */

    async listSchools(studentIds) {
      const list = await inBatches<School>(studentIds, (batch) =>
        db().from('schools').select('*').in('student_id', batch).order('deadline', { ascending: true, nullsFirst: false }),
      );
      return sorted(list, ascNullsLast((s) => s.deadline));
    },

    async createSchool(studentId, school) {
      const { deadline, ...rest } = school;
      return row<School>(
        await db()
          .from('schools')
          .insert({ ...rest, deadline: emptyToNull(deadline), student_id: studentId })
          .select()
          .single(),
      );
    },

    async updateSchool(id, updates) {
      const patch: Record<string, unknown> = { ...updates };
      if ('deadline' in updates) patch.deadline = emptyToNull(updates.deadline);
      return row<School>(await db().from('schools').update(patch).eq('id', id).select().single(), UPDATE_BLOCKED);
    },

    async deleteSchool(id) {
      ensureAffected(await db().from('schools').delete().eq('id', id).select('id'), 'delete');
    },

    /* Prompts ------------------------------------------------------------- */

    async listPrompts(schoolIds) {
      const list = await inBatches<Prompt>(schoolIds, (batch) =>
        db().from('prompts').select('*').in('school_id', batch).order('sort_order', { ascending: true }),
      );
      return sorted(list, byNumber((p) => p.sort_order));
    },

    async createPrompt(prompt) {
      return row<Prompt>(await db().from('prompts').insert(prompt).select().single());
    },

    async updatePrompt(id, updates) {
      return row<Prompt>(await db().from('prompts').update(updates).eq('id', id).select().single(), UPDATE_BLOCKED);
    },

    async deletePrompt(id) {
      ensureAffected(await db().from('prompts').delete().eq('id', id).select('id'), 'delete');
    },

    /* Essays -------------------------------------------------------------- */

    async listEssays(studentIds) {
      return inBatches<Essay>(studentIds, (batch) => db().from('essays').select('*').in('student_id', batch));
    },

    async createEssay(input) {
      const findExisting = async (): Promise<Essay | null> => {
        const result = await db()
          .from('essays')
          .select('*')
          .eq('prompt_id', input.prompt_id)
          .eq('student_id', input.student_id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (result.error) fail(result.error);
        return (result.data as Essay | null) ?? null;
      };

      const existing = await findExisting();
      if (existing) return existing;

      const content = input.content ?? '';
      const result = await db()
        .from('essays')
        .insert({
          prompt_id: input.prompt_id,
          student_id: input.student_id,
          content,
          word_count: input.word_count ?? 0,
          status: content.trim() ? 'draft' : 'not_started',
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (result.error?.code === '23505') {
        // Someone else created it between our check and insert.
        const raced = await findExisting();
        if (raced) return raced;
      }
      return row<Essay>(result);
    },

    async updateEssay(id, updates) {
      return row<Essay>(
        await db()
          .from('essays')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single(),
        UPDATE_BLOCKED,
      );
    },

    async listEssayVersions(essayId) {
      if (!essayId) return [];
      return rows<EssayVersion>(
        await db().from('essay_versions').select('*').eq('essay_id', essayId).order('created_at', { ascending: false }),
      );
    },

    async createEssayVersion(input) {
      return row<EssayVersion>(
        await db()
          .from('essay_versions')
          .insert({ essay_id: input.essay_id, content: input.content, word_count: input.word_count })
          .select()
          .single(),
      );
    },

    async listComments(essayIds) {
      const list = await inBatches<EssayComment & { author?: Profile | null }>(essayIds, (batch) =>
        db()
          .from('essay_comments')
          .select('*, author:profiles(*)')
          .in('essay_id', batch)
          .order('created_at', { ascending: true }),
      );
      return sorted(list.map(withAuthor), ascNullsLast((c) => c.created_at));
    },

    async createComment(input) {
      const created = row<EssayComment & { author?: Profile | null }>(
        await db()
          .from('essay_comments')
          .insert({ essay_id: input.essay_id, author_id: input.author_id, content: input.content })
          .select('*, author:profiles(*)')
          .single(),
      );
      return withAuthor(created);
    },

    /* Tasks --------------------------------------------------------------- */

    async listTasks(studentIds) {
      const list = await inBatches<Task>(studentIds, (batch) =>
        db().from('tasks').select('*').in('student_id', batch).order('due_date', { ascending: true, nullsFirst: false }),
      );
      return sorted(list, ascNullsLast((t) => t.due_date));
    },

    async createTask(task) {
      return row<Task>(
        await db()
          .from('tasks')
          .insert({
            student_id: task.student_id,
            created_by: task.created_by,
            title: task.title,
            category: task.category,
            due_date: emptyToNull(task.due_date),
            completed: false,
            completed_at: null,
          })
          .select()
          .single(),
      );
    },

    async updateTask(id, updates) {
      const patch: Record<string, unknown> = { ...updates };
      if ('due_date' in updates) patch.due_date = emptyToNull(updates.due_date);
      return row<Task>(await db().from('tasks').update(patch).eq('id', id).select().single(), UPDATE_BLOCKED);
    },

    async deleteTask(id) {
      ensureAffected(await db().from('tasks').delete().eq('id', id).select('id'), 'delete');
    },

    /* Activities ---------------------------------------------------------- */

    async listActivities(studentId) {
      if (!studentId) return [];
      return rows<Activity>(
        await db().from('activities').select('*').eq('student_id', studentId).order('position_order', { ascending: true }),
      );
    },

    async createActivity(activity) {
      return row<Activity>(await db().from('activities').insert(activity).select().single());
    },

    async updateActivity(id, updates) {
      ensureAffected(await db().from('activities').update(updates).eq('id', id).select('id'), 'change');
    },

    async deleteActivity(id) {
      ensureAffected(await db().from('activities').delete().eq('id', id).select('id'), 'delete');
    },

    /* Messaging ----------------------------------------------------------- */

    async listConversationsForUser(userId) {
      if (!userId) return [];
      return rows<Conversation>(
        await db().from('conversations').select('*').or(`student_id.eq.${userId},consultant_id.eq.${userId}`),
      );
    },

    async listConversationsForStudents(studentIds) {
      return inBatches<Conversation>(studentIds, (batch) => db().from('conversations').select('*').in('student_id', batch));
    },

    async createConversation(input) {
      return row<Conversation>(
        await db()
          .from('conversations')
          .insert({ student_id: input.student_id, consultant_id: input.consultant_id })
          .select()
          .single(),
      );
    },

    async listMessages(conversationIds) {
      const list = await inBatches<Message & { sender?: Profile | null }>(conversationIds, (batch) =>
        db()
          .from('messages')
          .select('*, sender:profiles(*)')
          .in('conversation_id', batch)
          .order('created_at', { ascending: true }),
      );
      return sorted(list.map(withSender), ascNullsLast((m) => m.created_at));
    },

    async sendMessage(input) {
      const created = row<Message & { sender?: Profile | null }>(
        await db()
          .from('messages')
          .insert({ conversation_id: input.conversation_id, sender_id: input.sender_id, content: input.content })
          .select('*, sender:profiles(*)')
          .single(),
      );
      return withSender(created);
    },

    subscribeToMessages(conversationIds, onInsert) {
      const ids = uniqueIds(conversationIds);
      if (ids.length === 0) return () => {};

      const supabase = db();
      channelCounter += 1;
      const channel = supabase.channel(`messages:${ids.join('-')}:${channelCounter}`);
      let active = true;

      const handleInsert = async (payload: { new: Record<string, unknown> }) => {
        const message = payload.new as unknown as Message;
        if (!message || typeof message.id !== 'string') return;
        let sender: Profile | undefined;
        try {
          const result = await supabase.from('profiles').select('*').eq('id', message.sender_id).maybeSingle();
          if (!result.error && result.data) sender = result.data as Profile;
        } catch {
          // Sender profile is optional (may be hidden by RLS); deliver the message without it.
        }
        if (active) onInsert(sender ? { ...message, sender } : message);
      };

      for (const id of ids) {
        channel.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
          (payload) => {
            void handleInsert(payload);
          },
        );
      }

      channel.subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`Live messages unavailable (${status})`, err?.message ?? '');
        }
      });

      return () => {
        active = false;
        void supabase.removeChannel(channel);
      };
    },

    /* Files --------------------------------------------------------------- */

    async listFiles(studentIds) {
      const list = await inBatches<SharedFile>(studentIds, (batch) =>
        db().from('files').select('*').in('student_id', batch).order('created_at', { ascending: false }),
      );
      return sorted(list, desc(ascNullsLast<SharedFile>((f) => f.created_at)));
    },

    async uploadFile(input) {
      const supabase = db();
      const { file } = input;
      const path = `${input.student_id}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

      const upload = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (upload.error) fail(upload.error, 'The file could not be uploaded. Please try again.');

      const inserted = await supabase
        .from('files')
        .insert({
          name: file.name,
          storage_path: path,
          folder: input.folder || 'General',
          size_bytes: file.size,
          student_id: input.student_id,
          uploaded_by: input.uploaded_by,
        })
        .select()
        .single();
      if (inserted.error || !inserted.data) {
        // Do not leave an orphaned object behind.
        await supabase.storage
          .from(BUCKET)
          .remove([path])
          .catch(() => undefined);
        fail(inserted.error, 'The file was uploaded but could not be saved. Please try again.');
      }
      return inserted.data as SharedFile;
    },

    async getFileUrl(file) {
      const { data, error } = await db().storage.from(BUCKET).createSignedUrl(file.storage_path, 120);
      if (error) fail(error, 'Could not open this file. Please try again.');
      if (!data?.signedUrl) throw new Error('Could not open this file. Please try again.');
      return data.signedUrl;
    },

    async deleteFile(file) {
      const supabase = db();
      if (file.storage_path) {
        const removed = await supabase.storage.from(BUCKET).remove([file.storage_path]);
        if (removed.error && !(removed.error.message ?? '').toLowerCase().includes('not found')) {
          fail(removed.error, 'The file could not be deleted. Please try again.');
        }
      }
      ensureAffected(await supabase.from('files').delete().eq('id', file.id).select('id'), 'delete');
    },
  };
}
