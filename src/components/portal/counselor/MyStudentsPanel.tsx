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

  useEffect(() => {
    if (!profile?.id) return;
    const supabase = getSupabase();

    async function load() {
      const { data: students } = await supabase
        .from('profiles')
        .select('*')
        .eq('assigned_consultant_id', profile!.id)
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
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">My Students</h1>
        <p className="text-portal-body text-sm mt-1.5">{studentData.length} active student{studentData.length !== 1 ? 's' : ''}</p>
      </div>

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
                    <h3 className="text-base font-semibold text-portal-text">{student.full_name}</h3>
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
