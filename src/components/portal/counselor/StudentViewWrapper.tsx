'use client';

import { useState, useEffect, useRef } from 'react';
import type { TabId } from '@/app/portal/page';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import type { Profile, School, Task, Message, Activity, Essay, Prompt, Conversation, EssayComment } from '@/types/database';
import SchoolDetail from '@/components/portal/SchoolDetail';

interface Props {
  studentId: string;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onBack: () => void;
}

const studentTabs: { id: TabId; name: string }[] = [
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'schools', name: 'Schools & Essays' },
  { id: 'tasks', name: 'Tasks' },
  { id: 'activities', name: 'Activities' },
  { id: 'messages', name: 'Messages' },
  { id: 'files', name: 'Files' },
];

const categoryColors: Record<string, { bg: string; text: string }> = {
  reach: { bg: 'bg-portal-rose/10', text: 'text-portal-rose' },
  target: { bg: 'bg-portal-amber/10', text: 'text-portal-amber' },
  safety: { bg: 'bg-portal-green/10', text: 'text-portal-green' },
};

export default function StudentViewWrapper({ studentId, activeTab, onTabChange, onBack }: Props) {
  const { profile } = useAuth();
  const [student, setStudent] = useState<Profile | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [essays, setEssays] = useState<Essay[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [comments, setComments] = useState<EssayComment[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = getSupabase();

    async function load() {
      // Fetch student profile
      const { data: studentData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single();
      if (!studentData) { setLoading(false); return; }
      setStudent(studentData as Profile);

      // Fetch all related data in parallel
      const [schoolRes, essayRes, taskRes, activityRes, convRes] = await Promise.all([
        supabase.from('schools').select('*').eq('student_id', studentId).order('deadline', { ascending: true }),
        supabase.from('essays').select('*').eq('student_id', studentId),
        supabase.from('tasks').select('*').eq('student_id', studentId).order('due_date', { ascending: true }),
        supabase.from('activities').select('*').eq('student_id', studentId).order('position_order', { ascending: true }),
        supabase.from('conversations').select('*').eq('student_id', studentId).limit(1).single(),
      ]);

      const schoolList = (schoolRes.data as School[]) || [];
      const essayList = (essayRes.data as Essay[]) || [];
      setSchools(schoolList);
      setEssays(essayList);
      setTasks((taskRes.data as Task[]) || []);
      setActivities((activityRes.data as Activity[]) || []);

      // Fetch prompts for all schools
      const schoolIds = schoolList.map(s => s.id);
      if (schoolIds.length > 0) {
        const { data: promptData } = await supabase
          .from('prompts')
          .select('*')
          .in('school_id', schoolIds)
          .order('sort_order', { ascending: true });
        setPrompts((promptData as Prompt[]) || []);
      }

      // Fetch comments for all essays
      const essayIds = essayList.map(e => e.id);
      if (essayIds.length > 0) {
        const { data: commentData } = await supabase
          .from('essay_comments')
          .select('*, author:profiles(*)')
          .in('essay_id', essayIds);
        setComments((commentData as EssayComment[]) || []);
      }

      // Messages
      if (convRes.data) {
        const conv = convRes.data as Conversation;
        setConversation(conv);
        const { data: msgs } = await supabase
          .from('messages')
          .select('*, sender:profiles(*)')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });
        setMessages((msgs as Message[]) || []);

        // Realtime
        supabase
          .channel(`sv-messages:${conv.id}`)
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
      }

      setLoading(false);
    }

    load();

    return () => {
      getSupabase().removeAllChannels();
    };
  }, [studentId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  if (loading || !student) {
    return (
      <div className="min-h-screen bg-portal-bg flex items-center justify-center">
        <p className="text-sm text-portal-muted">Loading student data...</p>
      </div>
    );
  }

  const completedEssays = essays.filter(e => e.status === 'final' || e.status === 'submitted').length;
  const inProgress = essays.filter(e => e.status === 'draft' || e.status === 'in_review' || e.status === 'revision').length;
  const totalPrompts = prompts.length;
  const progressPercent = totalPrompts > 0 ? Math.round((completedEssays / totalPrompts) * 100) : 0;
  const overdueTasks = tasks.filter(t => !t.completed && new Date(t.due_date) < new Date());

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newCompleted = !task.completed;
    const newCompletedAt = newCompleted ? new Date().toISOString() : null;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: newCompleted, completed_at: newCompletedAt } : t));
    const supabase = getSupabase();
    await supabase.from('tasks').update({ completed: newCompleted, completed_at: newCompletedAt }).eq('id', id);
  };

  const sendMessage = async () => {
    if (!input.trim() || !conversation || !profile) return;
    const supabase = getSupabase();
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: profile.id,
      content: input,
    });
    setInput('');
  };

  // School detail drill-in
  if (selectedSchool) {
    const schoolPrompts = prompts.filter(p => p.school_id === selectedSchool.id).map(prompt => {
      const essay = essays.find(e => e.prompt_id === prompt.id);
      const promptComments = essay ? comments.filter(c => c.essay_id === essay.id) : [];
      return { ...prompt, essay, comments: promptComments };
    });

    return (
      <div className="min-h-screen bg-portal-bg">
        <StudentBanner student={student} onBack={onBack} />
        <div className="flex">
          <StudentSidebar activeTab={activeTab} onTabChange={(t) => { onTabChange(t); setSelectedSchool(null); }} student={student} />
          <main className="flex-1 overflow-y-auto portal-scroll h-screen">
            <SchoolDetail school={selectedSchool} prompts={schoolPrompts} onBack={() => setSelectedSchool(null)} />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-portal-bg">
      <StudentBanner student={student} onBack={onBack} />
      <div className="flex" style={{ height: 'calc(100vh - 48px)' }}>
        <StudentSidebar activeTab={activeTab} onTabChange={onTabChange} student={student} />
        <main className="flex-1 overflow-y-auto portal-scroll">
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="p-6 lg:p-8 max-w-6xl">
              <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)] mb-6">{student.full_name}&apos;s Dashboard</h1>
              <div className="bg-portal-surface border border-portal-border-subtle rounded-lg p-6 mb-6" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="flex items-center gap-6">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" className="text-portal-border-subtle" strokeWidth="8" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#a855f7" strokeWidth="8" strokeDasharray={`${progressPercent * 2.51} 251`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center"><span className="text-lg font-bold text-portal-text font-[family-name:var(--font-space-mono)]">{progressPercent}%</span></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 flex-1">
                    <div><p className="text-2xl font-bold text-portal-green font-[family-name:var(--font-space-mono)]">{completedEssays}</p><p className="text-sm text-portal-muted">Done</p></div>
                    <div><p className="text-2xl font-bold text-portal-amber font-[family-name:var(--font-space-mono)]">{inProgress}</p><p className="text-sm text-portal-muted">In Progress</p></div>
                    <div><p className="text-2xl font-bold text-portal-dim font-[family-name:var(--font-space-mono)]">{totalPrompts - completedEssays - inProgress}</p><p className="text-sm text-portal-muted">Not Started</p></div>
                  </div>
                </div>
              </div>
              {overdueTasks.length > 0 && (
                <div className="bg-portal-rose/5 border border-portal-rose/20 rounded-lg p-4 mb-6">
                  <p className="text-sm text-portal-rose font-medium">{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}</p>
                  {overdueTasks.map(t => <p key={t.id} className="text-xs text-portal-muted mt-1">&middot; {t.title}</p>)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => onTabChange('schools')} className="bg-portal-surface border border-portal-border-subtle rounded-lg p-5 text-left hover:border-portal-accent/30 transition-colors" style={{ boxShadow: 'var(--shadow-card)' }}>
                  <h3 className="text-sm font-semibold text-portal-text mb-2">{schools.filter(s => !s.is_common_app).length} Schools</h3>
                  <p className="text-xs text-portal-muted">{totalPrompts} total prompts</p>
                </button>
                <button onClick={() => onTabChange('tasks')} className="bg-portal-surface border border-portal-border-subtle rounded-lg p-5 text-left hover:border-portal-accent/30 transition-colors" style={{ boxShadow: 'var(--shadow-card)' }}>
                  <h3 className="text-sm font-semibold text-portal-text mb-2">{tasks.filter(t => t.completed).length}/{tasks.length} Tasks</h3>
                  <p className="text-xs text-portal-muted">{tasks.filter(t => !t.completed).length} remaining</p>
                </button>
              </div>
            </div>
          )}

          {/* Schools & Essays */}
          {activeTab === 'schools' && (
            <div className="p-6 lg:p-8 max-w-6xl">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Schools & Essays</h1>
              </div>
              {schools.length === 0 ? (
                <p className="text-sm text-portal-muted">No schools added yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                  {[...schools].sort((a, b) => a.is_common_app ? -1 : b.is_common_app ? 1 : 0).map(school => {
                    const sp = prompts.filter(p => p.school_id === school.id);
                    const se = sp.map(p => essays.find(e => e.prompt_id === p.id));
                    const started = se.filter(e => e && e.status !== 'not_started').length;
                    const colors = categoryColors[school.category] || categoryColors.target;
                    return (
                      <button key={school.id} onClick={() => setSelectedSchool(school)} className={`bg-portal-surface border border-portal-border-subtle rounded-lg p-5 text-left hover:border-portal-accent/40 hover:-translate-y-0.5 transition-all ${school.is_common_app ? 'md:col-span-2 xl:col-span-3' : ''}`} style={{ boxShadow: 'var(--shadow-card)' }}>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-base font-semibold text-portal-text">{school.name}</h3>
                          <span className={`text-xs font-medium px-2 py-1 rounded-md ${school.is_common_app ? 'bg-portal-accent/10 text-portal-accent' : `${colors.bg} ${colors.text}`}`}>{school.is_common_app ? 'Common App' : school.category.charAt(0).toUpperCase() + school.category.slice(1)}</span>
                        </div>
                        <p className="text-sm text-portal-muted">{school.program}</p>
                        {school.deadline && <p className="text-xs text-portal-dim font-[family-name:var(--font-space-mono)] mt-1">{school.decision_plan} &mdash; {new Date(school.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>}
                        <p className="text-xs text-portal-dim mt-2">{sp.length} prompts &middot; {started}/{sp.length} started</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tasks */}
          {activeTab === 'tasks' && (
            <div className="p-6 lg:p-8 max-w-4xl">
              <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)] mb-6">Tasks</h1>
              {tasks.length === 0 ? (
                <p className="text-sm text-portal-muted">No tasks assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map(task => {
                    const isOverdue = !task.completed && new Date(task.due_date) < new Date();
                    return (
                      <div key={task.id} className={`bg-portal-surface border rounded-lg px-5 py-4 flex items-center gap-4 ${isOverdue ? 'border-portal-rose/30' : 'border-portal-border-subtle'}`} style={{ boxShadow: 'var(--shadow-card)' }}>
                        <button onClick={() => toggleTask(task.id)} className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center ${task.completed ? 'bg-portal-green border-portal-green' : 'border-portal-dim hover:border-portal-green'}`}>
                          {task.completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                        </button>
                        <p className={`text-sm flex-1 ${task.completed ? 'line-through text-portal-dim' : 'text-portal-text'}`}>{task.title}</p>
                        <span className={`text-xs font-[family-name:var(--font-space-mono)] ${isOverdue ? 'text-portal-rose' : 'text-portal-dim'}`}>
                          {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Activities */}
          {activeTab === 'activities' && (
            <div className="p-6 lg:p-8 max-w-4xl">
              <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)] mb-6">Activities ({activities.length}/10)</h1>
              {activities.length === 0 ? (
                <p className="text-sm text-portal-muted">No activities yet.</p>
              ) : (
                <div className="space-y-2">
                  {activities.map(act => (
                    <div key={act.id} className="bg-portal-surface border border-portal-border-subtle rounded-lg px-5 py-4" style={{ boxShadow: 'var(--shadow-card)' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-portal-dim font-[family-name:var(--font-space-mono)] w-6">#{act.position_order}</span>
                        <span className="text-sm font-medium text-portal-text flex-1">{act.activity_name}</span>
                        <span className="text-xs text-portal-muted">{act.role}</span>
                        <span className="text-xs text-portal-dim font-[family-name:var(--font-space-mono)]">{act.hours_per_week}h/wk</span>
                      </div>
                      <p className="text-xs text-portal-muted mt-2 ml-9">{act.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {activeTab === 'messages' && (
            <div className="flex flex-col h-full">
              <div className="px-6 py-4 border-b border-portal-border-subtle">
                <h2 className="text-base font-semibold text-portal-text">Chat with {student.full_name}</h2>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto portal-scroll px-6 py-4 space-y-3">
                {messages.length === 0 && (
                  <p className="text-sm text-portal-muted text-center py-8">No messages yet. Start the conversation.</p>
                )}
                {messages.map(msg => {
                  const isMe = msg.sender_id === profile?.id;
                  return (
                    <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${isMe ? 'bg-portal-green/20 text-portal-green' : 'bg-[rgba(168,85,247,0.12)] text-portal-accent'}`}>
                        {msg.sender?.avatar_initials}
                      </div>
                      <div className={`max-w-[70%]`}>
                        <div className={`rounded-2xl px-4 py-2.5 text-sm ${isMe ? 'bg-portal-green text-white rounded-tr-sm' : 'border border-portal-border-subtle text-portal-text rounded-tl-sm'}`}>{msg.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-6 py-4 border-t border-portal-border-subtle">
                <div className="flex gap-3">
                  <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." className="flex-1 border border-portal-border-subtle rounded-xl px-4 py-3 text-sm text-portal-text placeholder-portal-dim bg-portal-bg focus:outline-none focus:border-portal-green/50" />
                  <button onClick={sendMessage} disabled={!input.trim()} className="bg-portal-green text-white px-4 py-3 rounded-xl disabled:opacity-50">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Files */}
          {activeTab === 'files' && (
            <div className="p-6 lg:p-8 max-w-4xl">
              <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)] mb-6">Shared Files</h1>
              <p className="text-sm text-portal-muted">File management for {student.full_name}.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Purple banner at top
function StudentBanner({ student, onBack }: { student: Profile; onBack: () => void }) {
  return (
    <div className="bg-portal-accent/10 border-b border-portal-accent/20 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-portal-accent hover:text-portal-accent/80 transition-colors flex items-center gap-1 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back to My Students
        </button>
        <span className="text-portal-accent/40">|</span>
        <span className="text-sm font-medium text-portal-accent">Viewing: {student.full_name}</span>
      </div>
      <span className="text-[10px] text-portal-accent/60 uppercase tracking-wide">Counselor View</span>
    </div>
  );
}

// Student sidebar (shown when viewing a student)
function StudentSidebar({ activeTab, onTabChange, student }: { activeTab: TabId; onTabChange: (tab: TabId) => void; student: Profile }) {
  return (
    <div className="hidden lg:flex w-[250px] bg-portal-sidebar backdrop-blur-md border-r border-portal-border-subtle flex-col flex-shrink-0">
      <div className="px-5 py-5 border-b border-portal-border-subtle">
        <a href="/" className="text-xl font-bold text-portal-accent tracking-tight">DeltaX</a>
        <p className="text-xs text-portal-dim mt-0.5">Student Portal</p>
      </div>
      <nav className="flex-1 py-4 px-3">
        {studentTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => onTabChange(tab.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all relative ${isActive ? 'bg-portal-sidebar-active text-portal-text font-medium' : 'text-portal-muted/60 hover:text-portal-muted hover:bg-portal-hover'}`}>
              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-portal-accent rounded-r-full" />}
              <span>{tab.name}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-4 border-t border-portal-border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[rgba(168,85,247,0.12)] flex items-center justify-center text-portal-accent text-sm font-semibold">{student.avatar_initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-portal-text truncate">{student.full_name}</p>
            <p className="text-[10px] text-portal-green">Viewing as Counselor</p>
          </div>
        </div>
      </div>
    </div>
  );
}
