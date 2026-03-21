'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import type { Profile, Essay, Task, Prompt } from '@/types/database';

interface Props {
  onViewStudent: (id: string) => void;
}

const avatarColors = [
  'bg-[rgba(168,85,247,0.12)] text-portal-accent',
  'bg-portal-green/20 text-portal-green',
  'bg-portal-amber/20 text-portal-amber',
  'bg-portal-rose/20 text-portal-rose',
  'bg-blue-500/20 text-blue-400',
];

interface StudentData {
  student: Profile;
  essays: Essay[];
  tasks: Task[];
  promptCount: number;
}

export default function MyStudentsPanel({ onViewStudent }: Props) {
  const { profile } = useAuth();
  const [studentData, setStudentData] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const createStudent = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setFormError('Please fill in all fields.');
      return;
    }
    if (newPassword.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    setFormLoading(true);
    setFormError('');

    const res = await fetch('/api/create-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        fullName: newName,
        assignedConsultantId: profile?.id,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setFormError(data.error);
      setFormLoading(false);
      return;
    }

    // Refresh the student list
    setShowForm(false);
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setFormLoading(false);
    window.location.reload();
  };

  useEffect(() => {
    if (!profile?.id) return;
    const supabase = getSupabase();

    async function load() {
      const { data: students } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');

      const studentList = (students as Profile[]) || [];
      if (studentList.length === 0) { setLoading(false); return; }

      const ids = studentList.map(s => s.id);
      const [essayRes, taskRes, promptRes] = await Promise.all([
        supabase.from('essays').select('*').in('student_id', ids),
        supabase.from('tasks').select('*').in('student_id', ids),
        supabase.from('prompts').select('id, school_id, schools!inner(student_id)').in('schools.student_id', ids),
      ]);

      const allEssays = (essayRes.data as Essay[]) || [];
      const allTasks = (taskRes.data as Task[]) || [];
      const allPrompts = (promptRes.data as any[]) || [];

      const result = studentList.map(student => ({
        student,
        essays: allEssays.filter(e => e.student_id === student.id),
        tasks: allTasks.filter(t => t.student_id === student.id),
        promptCount: allPrompts.filter((p: any) => p.schools?.student_id === student.id).length,
      }));

      setStudentData(result);
      setLoading(false);
    }

    load();
  }, [profile?.id]);

  const now = new Date();

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">My Students</h1>
          <p className="text-portal-body text-sm mt-1.5">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">My Students</h1>
          <p className="text-portal-body text-sm mt-1.5">{studentData.length} active student{studentData.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-portal-green hover:bg-portal-green/90 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Student
        </button>
      </div>

      {showForm && (
        <div className="bg-portal-surface border border-portal-border-subtle rounded-lg p-5 mb-6" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading mb-4">New Student Account</h3>
          <div className="space-y-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2.5 text-sm text-portal-text placeholder-portal-dim focus:outline-none focus:border-portal-green/50" />
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email address" type="email" className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2.5 text-sm text-portal-text placeholder-portal-dim focus:outline-none focus:border-portal-green/50" />
            <input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Password (min 6 characters)" type="text" className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2.5 text-sm text-portal-text placeholder-portal-dim focus:outline-none focus:border-portal-green/50" />
            {formError && <p className="text-xs text-portal-rose">{formError}</p>}
            <div className="flex items-center gap-3">
              <button onClick={createStudent} disabled={formLoading} className="bg-portal-green hover:bg-portal-green/90 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {formLoading ? 'Creating...' : 'Create Student'}
              </button>
              <button onClick={() => { setShowForm(false); setFormError(''); }} className="text-sm text-portal-muted hover:text-portal-text transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {studentData.length === 0 ? (
        <p className="text-sm text-portal-muted">No students assigned yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {studentData.map(({ student, essays, tasks, promptCount }, idx) => {
            const completedEssays = essays.filter(e => e.status === 'final' || e.status === 'submitted').length;
            const completedTasks = tasks.filter(t => t.completed).length;
            const overdueTasks = tasks.filter(t => !t.completed && new Date(t.due_date) < now).length;
            const reviewEssays = essays.filter(e => e.status === 'in_review').length;
            const overallProgress = promptCount > 0 ? Math.round((completedEssays / promptCount) * 100) : 0;

            let statusDot = 'bg-portal-green';
            let statusText = 'On track';
            if (overdueTasks > 0) { statusDot = 'bg-portal-rose'; statusText = `${overdueTasks} overdue task${overdueTasks > 1 ? 's' : ''}`; }
            else if (reviewEssays > 0) { statusDot = 'bg-portal-amber'; statusText = `${reviewEssays} essay${reviewEssays > 1 ? 's' : ''} awaiting review`; }

            return (
              <button
                key={student.id}
                onClick={() => onViewStudent(student.id)}
                className="bg-portal-surface border border-portal-border-subtle rounded-lg p-5 text-left hover:border-portal-green/40 hover:-translate-y-0.5 transition-all duration-200"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColors[idx % avatarColors.length]}`}>
                    {student.avatar_initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-portal-text">{student.full_name}</h3>
                      {student.assigned_consultant_id === profile?.id && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-portal-green/15 text-portal-green">Primary</span>
                      )}
                    </div>
                    <p className="text-xs text-portal-muted">{student.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-portal-bg rounded-lg p-2 text-center">
                    <p className="text-sm font-bold text-portal-text font-[family-name:var(--font-space-mono)]">{completedEssays}/{promptCount}</p>
                    <p className="text-[10px] text-portal-dim">Essays</p>
                  </div>
                  <div className="bg-portal-bg rounded-lg p-2 text-center">
                    <p className="text-sm font-bold text-portal-text font-[family-name:var(--font-space-mono)]">{completedTasks}/{tasks.length}</p>
                    <p className="text-[10px] text-portal-dim">Tasks</p>
                  </div>
                  <div className="bg-portal-bg rounded-lg p-2 text-center">
                    <p className="text-sm font-bold text-portal-text font-[family-name:var(--font-space-mono)]">{overallProgress}%</p>
                    <p className="text-[10px] text-portal-dim">Progress</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusDot}`} />
                  <span className="text-xs text-portal-muted">{statusText}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
