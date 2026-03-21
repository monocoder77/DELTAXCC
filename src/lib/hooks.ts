'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type {
  School, Prompt, Essay, Task, Activity,
  Message, Conversation, Profile, PromptWithEssay,
} from '@/types/database';

// ─── Schools ───

export function useSchools(studentId?: string) {
  const { user } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);

  const id = studentId || user?.id;

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    const supabase = getSupabase();
    supabase
      .from('schools')
      .select('*')
      .eq('student_id', id)
      .order('deadline', { ascending: true })
      .then(({ data }) => {
        setSchools((data as School[]) || []);
        setLoading(false);
      });
  }, [id]);

  const addSchool = useCallback(async (school: Omit<School, 'id' | 'created_at' | 'student_id'>) => {
    if (!id) return;
    const supabase = getSupabase();
    const { data } = await supabase
      .from('schools')
      .insert({ ...school, student_id: id })
      .select()
      .single();
    if (data) setSchools(prev => [...prev, data as School]);
  }, [id]);

  return { schools, loading, addSchool, setSchools };
}

// ─── Prompts & Essays for a School ───

export function usePromptsForSchool(schoolId: string) {
  const [prompts, setPrompts] = useState<PromptWithEssay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) { setLoading(false); return; }
    const supabase = getSupabase();
    supabase
      .from('prompts')
      .select('*, essays(*), essay_comments:essays(essay_comments(*, author:profiles(*)))')
      .eq('school_id', schoolId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (data) {
          const mapped = data.map((p: any) => {
            const essay = p.essays?.[0] || undefined;
            const comments = essay ? (p.essay_comments?.[0]?.essay_comments || []) : [];
            return { ...p, essays: undefined, essay_comments: undefined, essay, comments };
          });
          setPrompts(mapped);
        }
        setLoading(false);
      });
  }, [schoolId]);

  return { prompts, loading };
}

// ─── All Prompts & Essays (for dashboard stats) ───

export function useAllPrompts(studentId?: string) {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [essays, setEssays] = useState<Essay[]>([]);
  const [loading, setLoading] = useState(true);

  const id = studentId || user?.id;

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    const supabase = getSupabase();
    Promise.all([
      supabase.from('prompts').select('*, schools!inner(student_id)').eq('schools.student_id', id),
      supabase.from('essays').select('*').eq('student_id', id),
    ]).then(([promptsRes, essaysRes]) => {
      setPrompts((promptsRes.data as Prompt[]) || []);
      setEssays((essaysRes.data as Essay[]) || []);
      setLoading(false);
    });
  }, [id]);

  return { prompts, essays, loading };
}

// ─── Tasks ───

export function useTasks(studentId?: string) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const id = studentId || user?.id;

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    const supabase = getSupabase();
    supabase
      .from('tasks')
      .select('*')
      .eq('student_id', id)
      .order('due_date', { ascending: true })
      .then(({ data }) => {
        setTasks((data as Task[]) || []);
        setLoading(false);
      });
  }, [id]);

  const toggleTask = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCompleted = !task.completed;
    const newCompletedAt = newCompleted ? new Date().toISOString() : null;

    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, completed: newCompleted, completed_at: newCompletedAt } : t
    ));

    const supabase = getSupabase();
    await supabase
      .from('tasks')
      .update({ completed: newCompleted, completed_at: newCompletedAt })
      .eq('id', taskId);
  }, [tasks]);

  return { tasks, loading, toggleTask, setTasks };
}

// ─── Activities ───

export function useActivities(studentId?: string) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const id = studentId || user?.id;

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    const supabase = getSupabase();
    supabase
      .from('activities')
      .select('*')
      .eq('student_id', id)
      .order('position_order', { ascending: true })
      .then(({ data }) => {
        setActivities((data as Activity[]) || []);
        setLoading(false);
      });
  }, [id]);

  const updateActivity = useCallback(async (activityId: string, updates: Partial<Activity>) => {
    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, ...updates } : a));
    const supabase = getSupabase();
    await supabase.from('activities').update(updates).eq('id', activityId);
  }, []);

  const deleteActivity = useCallback(async (activityId: string) => {
    setActivities(prev => {
      const filtered = prev.filter(a => a.id !== activityId);
      return filtered.map((a, i) => ({ ...a, position_order: i + 1 }));
    });
    const supabase = getSupabase();
    await supabase.from('activities').delete().eq('id', activityId);
  }, []);

  const addActivity = useCallback(async () => {
    if (activities.length >= 10 || !id) return;
    const supabase = getSupabase();
    const { data } = await supabase
      .from('activities')
      .insert({
        student_id: id,
        position_order: activities.length + 1,
        activity_name: 'New Activity',
        activity_type: 'Other',
        role: '',
        organization: '',
        grade_levels: '',
        timing: '',
        hours_per_week: 0,
        weeks_per_year: 0,
        description: '',
      })
      .select()
      .single();
    if (data) {
      setActivities(prev => [...prev, data as Activity]);
      return (data as Activity).id;
    }
  }, [activities.length, id]);

  const reorderActivities = useCallback(async (reordered: Activity[]) => {
    const renumbered = reordered.map((a, i) => ({ ...a, position_order: i + 1 }));
    setActivities(renumbered);
    const supabase = getSupabase();
    for (const a of renumbered) {
      await supabase.from('activities').update({ position_order: a.position_order }).eq('id', a.id);
    }
  }, []);

  return { activities, loading, updateActivity, deleteActivity, addActivity, reorderActivities, setActivities };
}

// ─── Messages ───

export function useMessages(studentId?: string) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [consultant, setConsultant] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const id = studentId || user?.id;

  useEffect(() => {
    if (!id) { setLoading(false); return; }

    const supabase = getSupabase();

    supabase
      .from('conversations')
      .select('*')
      .or(`student_id.eq.${id},consultant_id.eq.${id}`)
      .limit(1)
      .single()
      .then(async ({ data: conv }) => {
        if (!conv) {
          setLoading(false);
          return;
        }
        setConversation(conv as Conversation);

        const otherId = conv.student_id === id ? conv.consultant_id : conv.student_id;
        const { data: otherProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', otherId)
          .single();
        if (otherProfile) setConsultant(otherProfile as Profile);

        const { data: msgs } = await supabase
          .from('messages')
          .select('*, sender:profiles(*)')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });
        setMessages((msgs as Message[]) || []);
        setLoading(false);

        // Realtime subscription
        supabase
          .channel(`messages:${conv.id}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conv.id}`,
          }, async (payload) => {
            const newMsg = payload.new as Message;
            const { data: sender } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', newMsg.sender_id)
              .single();
            setMessages(prev => [...prev, { ...newMsg, sender: sender as Profile }]);
          })
          .subscribe();
      });

    return () => {
      getSupabase().removeAllChannels();
    };
  }, [id]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !conversation || !user) return;
    const supabase = getSupabase();
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      content,
    });
  }, [conversation, user]);

  return { messages, consultant, loading, sendMessage, senderProfile: profile };
}

// ─── Essay Operations ───

export function useEssayActions() {
  const updateEssay = useCallback(async (essayId: string, updates: { content?: string; status?: string; word_count?: number }) => {
    const supabase = getSupabase();
    await supabase.from('essays').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', essayId);
  }, []);

  const addComment = useCallback(async (essayId: string, authorId: string, content: string) => {
    const supabase = getSupabase();
    await supabase.from('essay_comments').insert({ essay_id: essayId, author_id: authorId, content });
  }, []);

  return { updateEssay, addComment };
}
