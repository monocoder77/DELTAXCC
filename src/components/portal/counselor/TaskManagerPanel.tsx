'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import type { Profile, Task } from '@/types/database';

const categories = ['Essays', 'Research', 'Activities', 'Recommendations', 'Testing', 'Action', 'Applications'];
type Filter = 'all' | 'pending' | 'completed' | 'overdue';

export default function TaskManagerPanel() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newStudent, setNewStudent] = useState('');
  const [newCategory, setNewCategory] = useState('Essays');
  const [newDueDate, setNewDueDate] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    const supabase = getSupabase();

    async function load() {
      const { data: studs } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');

      const studentList = (studs as Profile[]) || [];
      setStudents(studentList);
      if (studentList.length > 0) {
        setNewStudent(studentList[0].id);
        const ids = studentList.map(s => s.id);
        const { data: taskData } = await supabase
          .from('tasks')
          .select('*')
          .in('student_id', ids)
          .order('due_date', { ascending: true });
        setTasks((taskData as Task[]) || []);
      }
      setLoading(false);
    }

    load();
  }, [profile?.id]);

  const now = new Date();

  const filtered = tasks
    .filter(t => {
      if (studentFilter !== 'all' && t.student_id !== studentFilter) return false;
      if (filter === 'pending') return !t.completed;
      if (filter === 'completed') return t.completed;
      if (filter === 'overdue') return !t.completed && new Date(t.due_date) < now;
      return true;
    });

  const grouped: Record<string, Task[]> = {};
  filtered.forEach(t => {
    if (!grouped[t.student_id]) grouped[t.student_id] = [];
    grouped[t.student_id].push(t);
  });

  const createTask = async () => {
    if (!newTitle.trim() || !newDueDate || !profile) return;
    const supabase = getSupabase();
    const { data } = await supabase
      .from('tasks')
      .insert({
        student_id: newStudent,
        created_by: profile.id,
        title: newTitle,
        category: newCategory,
        due_date: newDueDate,
        completed: false,
      })
      .select()
      .single();
    if (data) setTasks(prev => [data as Task, ...prev]);
    setNewTitle('');
    setNewDueDate('');
    setShowForm(false);
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newCompleted = !task.completed;
    const newCompletedAt = newCompleted ? new Date().toISOString() : null;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: newCompleted, completed_at: newCompletedAt } : t));
    const supabase = getSupabase();
    await supabase.from('tasks').update({ completed: newCompleted, completed_at: newCompletedAt }).eq('id', id);
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    const supabase = getSupabase();
    await supabase.from('tasks').delete().eq('id', id);
  };

  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => !t.completed).length,
    completed: tasks.filter(t => t.completed).length,
    overdue: tasks.filter(t => !t.completed && new Date(t.due_date) < now).length,
  };

  const categoryColors: Record<string, string> = {
    Essays: 'bg-portal-accent/10 text-portal-accent',
    Research: 'bg-blue-500/10 text-blue-400',
    Activities: 'bg-portal-amber/10 text-portal-amber',
    Recommendations: 'bg-portal-green/10 text-portal-green',
    Testing: 'bg-portal-rose/10 text-portal-rose',
    Action: 'bg-purple-500/10 text-purple-400',
    Applications: 'bg-cyan-500/10 text-cyan-400',
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl">
        <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Task Manager</h1>
        <p className="text-portal-body text-sm mt-1.5">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Task Manager</h1>
          <p className="text-portal-body text-sm mt-1.5">Create and manage tasks across all students</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-portal-green hover:bg-portal-green/90 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Assign Task
        </button>
      </div>

      {showForm && (
        <div className="bg-portal-surface border border-portal-border-subtle rounded-lg p-5 mb-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading mb-4">New Task</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <select value={newStudent} onChange={e => setNewStudent(e.target.value)} className="bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2.5 text-sm text-portal-text focus:outline-none focus:border-portal-green/50">
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2.5 text-sm text-portal-text focus:outline-none focus:border-portal-green/50">
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Task description" className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2.5 text-sm text-portal-text placeholder-portal-dim focus:outline-none focus:border-portal-green/50 mb-3" />
          <div className="flex items-center gap-3">
            <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2.5 text-sm text-portal-text focus:outline-none focus:border-portal-green/50" />
            <button onClick={createTask} className="bg-portal-green hover:bg-portal-green/90 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">Create Task</button>
            <button onClick={() => setShowForm(false)} className="text-sm text-portal-muted hover:text-portal-text transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(['all', 'pending', 'completed', 'overdue'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${filter === f ? 'bg-portal-green text-white' : 'border border-portal-border-subtle text-portal-muted hover:text-portal-text'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)} <span className="ml-1 text-xs opacity-70">{counts[f]}</span>
          </button>
        ))}
        <select value={studentFilter} onChange={e => setStudentFilter(e.target.value)} className="ml-auto border border-portal-border-subtle rounded-lg px-3 py-1.5 text-sm text-portal-muted bg-portal-bg focus:outline-none">
          <option value="all">All Students</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-sm text-portal-muted">No tasks match this filter.</p>
      ) : (
        Object.entries(grouped).map(([studentId, studentTasks]) => {
          const student = students.find(s => s.id === studentId);
          return (
            <div key={studentId} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-portal-text">{student?.full_name}</h3>
                <span className="text-xs text-portal-dim">{studentTasks.length} task{studentTasks.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {studentTasks.map(task => {
                  const isOverdue = !task.completed && new Date(task.due_date) < now;
                  const catColor = categoryColors[task.category] || 'bg-portal-dim/10 text-portal-dim';
                  return (
                    <div key={task.id} className={`bg-portal-surface border rounded-lg px-5 py-3.5 flex items-center gap-4 ${isOverdue ? 'border-portal-rose/30' : 'border-portal-border-subtle'}`} style={{ boxShadow: 'var(--shadow-card)' }}>
                      <button onClick={() => toggleTask(task.id)} className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors ${task.completed ? 'bg-portal-green border-portal-green' : 'border-portal-dim hover:border-portal-green'}`}>
                        {task.completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                      </button>
                      <p className={`text-sm flex-1 ${task.completed ? 'line-through text-portal-dim' : 'text-portal-text'}`}>{task.title}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${catColor} flex-shrink-0 hidden sm:inline`}>{task.category}</span>
                      <span className={`text-xs font-[family-name:var(--font-space-mono)] flex-shrink-0 ${isOverdue ? 'text-portal-rose' : 'text-portal-dim'}`}>
                        {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <button onClick={() => deleteTask(task.id)} className="text-portal-dim hover:text-portal-rose transition-colors flex-shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
