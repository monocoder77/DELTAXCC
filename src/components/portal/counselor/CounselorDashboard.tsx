'use client';

import { useState, useEffect } from 'react';
import type { CounselorTabId } from '@/app/portal/page';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import type { Profile, School, Essay, Task } from '@/types/database';

interface Props {
  onNavigate: (tab: CounselorTabId) => void;
  onViewStudent: (id: string) => void;
}

export default function CounselorDashboard({ onNavigate, onViewStudent }: Props) {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [essays, setEssays] = useState<Essay[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schools, setSchools] = useState<(School & { student_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    const supabase = getSupabase();

    async function load() {
      const { data: studs } = await supabase
        .from('profiles')
        .select('*')
        .eq('assigned_consultant_id', profile!.id)
        .eq('role', 'student');
      const studentList = (studs as Profile[]) || [];
      setStudents(studentList);

      const ids = studentList.map(s => s.id);
      if (ids.length === 0) { setLoading(false); return; }

      const [essayRes, taskRes, schoolRes] = await Promise.all([
        supabase.from('essays').select('*').in('student_id', ids),
        supabase.from('tasks').select('*').in('student_id', ids),
        supabase.from('schools').select('*').in('student_id', ids).order('deadline', { ascending: true }),
      ]);

      setEssays((essayRes.data as Essay[]) || []);
      setTasks((taskRes.data as Task[]) || []);

      const schoolData = ((schoolRes.data as School[]) || []).map(s => ({
        ...s,
        student_name: studentList.find(st => st.id === s.student_id)?.full_name,
      }));
      setSchools(schoolData);
      setLoading(false);
    }

    load();
  }, [profile?.id]);

  const now = new Date();
  const essaysAwaitingReview = essays.filter(e => e.status === 'in_review').length;
  const overdueTasks = tasks.filter(t => !t.completed && new Date(t.due_date) < now).length;
  const totalStudents = students.length;

  const upcomingDeadlines = schools
    .filter(s => s.deadline && !s.is_common_app)
    .slice(0, 5)
    .map(s => {
      const daysLeft = Math.ceil((new Date(s.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { ...s, daysLeft };
    });

  const stats = [
    { label: 'Active Students', value: totalStudents, color: 'text-portal-accent' },
    { label: 'Essays to Review', value: essaysAwaitingReview, color: 'text-portal-amber' },
    { label: 'Overdue Tasks', value: overdueTasks, color: 'text-portal-rose' },
    { label: 'Unread Messages', value: 0, color: 'text-portal-green' },
  ];

  // Build attention items from real data
  const attentionItems: { id: string; student_name: string; student_initials: string; student_id: string; description: string; type: string; action_label: string; action_tab: string }[] = [];

  essays.filter(e => e.status === 'in_review').forEach(e => {
    const student = students.find(s => s.id === e.student_id);
    if (student) {
      attentionItems.push({
        id: `review-${e.id}`,
        student_name: student.full_name,
        student_initials: student.avatar_initials,
        student_id: student.id,
        description: 'submitted an essay for review',
        type: 'review',
        action_label: 'Review',
        action_tab: 'reviews',
      });
    }
  });

  tasks.filter(t => !t.completed && new Date(t.due_date) < now).forEach(t => {
    const student = students.find(s => s.id === t.student_id);
    if (student) {
      attentionItems.push({
        id: `overdue-${t.id}`,
        student_name: student.full_name,
        student_initials: student.avatar_initials,
        student_id: student.id,
        description: `has overdue task: ${t.title}`,
        type: 'overdue',
        action_label: 'View',
        action_tab: 'tasks',
      });
    }
  });

  const typeBadge: Record<string, { label: string; cls: string }> = {
    review: { label: 'Review', cls: 'bg-portal-amber/15 text-portal-amber' },
    overdue: { label: 'Overdue', cls: 'bg-portal-rose/15 text-portal-rose' },
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Counselor Dashboard</h1>
        <p className="text-portal-body mt-1.5">Overview of all your students&apos; progress.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(stat => (
          <div
            key={stat.label}
            className="bg-portal-surface rounded-lg p-5 border border-portal-border-subtle"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <p className={`text-2xl font-semibold font-[family-name:var(--font-space-mono)] ${stat.color} opacity-85`}>{stat.value}</p>
            <p className="text-sm text-portal-muted mt-1.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading mb-5">Needs Attention</h2>
          {attentionItems.length === 0 ? (
            <p className="text-sm text-portal-muted">All caught up — nothing needs attention right now.</p>
          ) : (
            <div className="space-y-3">
              {attentionItems.slice(0, 8).map(item => {
                const badge = typeBadge[item.type] || typeBadge.overdue;
                return (
                  <div
                    key={item.id}
                    className="bg-portal-surface rounded-lg px-5 py-4 flex items-center gap-4 border border-portal-border-subtle"
                    style={{ boxShadow: 'var(--shadow-card)' }}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 bg-[rgba(168,85,247,0.12)] text-portal-accent">
                      {item.student_initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-portal-text">
                        <span className="font-medium">{item.student_name}</span>{' '}
                        <span className="text-portal-body">{item.description}</span>
                      </p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (item.action_tab === 'reviews') onNavigate('c-reviews');
                        else if (item.action_tab === 'tasks') onNavigate('c-tasks');
                        else onViewStudent(item.student_id);
                      }}
                      className="text-xs font-medium text-portal-accent/80 hover:text-portal-accent transition-colors flex-shrink-0 border border-portal-accent/20 px-3 py-1.5 rounded-md hover:bg-portal-accent/5"
                    >
                      {item.action_label} &rarr;
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading mb-5">Upcoming Deadlines</h2>
          {upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-portal-muted">No upcoming deadlines.</p>
          ) : (
            <div
              className="bg-portal-surface rounded-lg overflow-hidden border border-portal-border-subtle"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              {upcomingDeadlines.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => onViewStudent(item.student_id)}
                  className={`w-full text-left px-5 py-4 hover:bg-portal-hover transition-colors ${i > 0 ? 'border-t border-portal-border-subtle' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-portal-text truncate">{item.student_name}</p>
                      <p className="text-xs text-portal-muted truncate">{item.name} — {item.decision_plan}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-xs font-[family-name:var(--font-space-mono)] text-portal-muted">
                        {new Date(item.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      {item.daysLeft < 0 ? (
                        <span className="text-[10px] font-medium font-[family-name:var(--font-space-mono)] text-portal-rose bg-portal-rose/12 px-1.5 py-0.5 rounded-md">
                          {Math.abs(item.daysLeft)}d overdue
                        </span>
                      ) : (
                        <p className={`text-[10px] font-[family-name:var(--font-space-mono)] ${item.daysLeft < 14 ? 'text-portal-amber' : 'text-portal-dim'}`}>
                          {item.daysLeft}d left
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
