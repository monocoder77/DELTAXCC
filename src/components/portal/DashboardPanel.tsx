'use client';

import type { TabId } from '@/app/portal/page';
import { useSchools, useAllPrompts, useTasks } from '@/lib/hooks';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardPanelProps {
  onNavigate: (tab: TabId) => void;
}

export default function DashboardPanel({ onNavigate }: DashboardPanelProps) {
  const { profile } = useAuth();
  const { schools } = useSchools();
  const { prompts, essays } = useAllPrompts();
  const { tasks } = useTasks();

  const totalPrompts = prompts.length;
  const completedEssays = essays.filter(e => e.status === 'submitted' || e.status === 'final').length;
  const inProgress = essays.filter(e => e.status === 'draft' || e.status === 'in_review' || e.status === 'revision').length;
  const notStarted = totalPrompts - completedEssays - inProgress;
  const progressPercent = totalPrompts > 0 ? Math.round((completedEssays / totalPrompts) * 100) : 0;

  const pendingTasks = tasks.filter(t => !t.completed);
  const overdueTasks = pendingTasks.filter(t => new Date(t.due_date) < new Date());

  const upcomingDeadlines = schools
    .filter(s => s.deadline && !s.is_common_app)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  const displayName = profile?.full_name?.split(' ')[0] || 'Alex';

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Welcome back, {displayName}</h1>
        <p className="text-portal-body mt-1.5">Here&apos;s an overview of your college application progress.</p>
      </div>

      {/* Progress Section */}
      <div
        className="bg-portal-surface border border-portal-border-subtle rounded-lg p-6 mb-10"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="40" fill="none"
                stroke="#a855f7" strokeWidth="8"
                strokeDasharray={`${progressPercent * 2.51} 251`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-semibold text-portal-text font-[family-name:var(--font-space-mono)]">{progressPercent}%</span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-semibold text-portal-green opacity-85 font-[family-name:var(--font-space-mono)]">{completedEssays}</p>
              <p className="text-sm text-portal-muted mt-1">Completed</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-portal-amber opacity-85 font-[family-name:var(--font-space-mono)]">{inProgress}</p>
              <p className="text-sm text-portal-muted mt-1">In Progress</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-portal-dim font-[family-name:var(--font-space-mono)]">{notStarted}</p>
              <p className="text-sm text-portal-muted mt-1">Not Started</p>
            </div>
          </div>
        </div>
      </div>

      {/* Segmented Grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 bg-portal-surface rounded-lg overflow-hidden border border-portal-border-subtle"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {/* Upcoming Tasks */}
        <button
          onClick={() => onNavigate('tasks')}
          className="p-5 hover:bg-portal-hover transition-colors text-left border-b md:border-b-0 md:border-r border-portal-border-subtle"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading">Upcoming Tasks</h3>
            <span className="text-xs text-portal-accent/80">View all &rarr;</span>
          </div>
          <div className="space-y-3.5">
            {pendingTasks.slice(0, 3).map(task => {
              const isOverdue = new Date(task.due_date) < new Date();
              return (
                <div key={task.id} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isOverdue ? 'bg-portal-rose' : 'bg-portal-amber'}`} />
                  <div className="min-w-0">
                    <p className="text-sm text-portal-text truncate">{task.title}</p>
                    <p className={`text-xs font-[family-name:var(--font-space-mono)] ${isOverdue ? 'text-portal-rose' : 'text-portal-dim'}`}>
                      Due {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </button>

        {/* Key Deadlines */}
        <button
          onClick={() => onNavigate('schools')}
          className="p-5 hover:bg-portal-hover transition-colors text-left border-b border-portal-border-subtle"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading">Key Deadlines</h3>
            <span className="text-xs text-portal-accent/80">View all &rarr;</span>
          </div>
          <div className="space-y-3.5">
            {upcomingDeadlines.map(school => (
              <div key={school.id} className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-portal-text truncate">{school.name}</p>
                  <p className="text-xs text-portal-dim">{school.decision_plan}</p>
                </div>
                <span className="text-xs font-[family-name:var(--font-space-mono)] text-portal-muted ml-3">
                  {new Date(school.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </button>

        {/* Recent Messages */}
        <button
          onClick={() => onNavigate('messages')}
          className="p-5 hover:bg-portal-hover transition-colors text-left md:border-r border-portal-border-subtle"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading">Recent Messages</h3>
            <span className="text-xs text-portal-accent/80">View all &rarr;</span>
          </div>
          <div className="space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[rgba(168,85,247,0.12)] flex items-center justify-center text-portal-accent/80 text-xs font-semibold flex-shrink-0">SC</div>
              <div className="min-w-0">
                <p className="text-sm text-portal-text">Sarah Chen</p>
                <p className="text-xs text-portal-body truncate">I just added the Cornell prompts to your Schools & Essays tab...</p>
              </div>
            </div>
          </div>
        </button>

        {/* Schools at a Glance */}
        <button
          onClick={() => onNavigate('schools')}
          className="p-5 hover:bg-portal-hover transition-colors text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading">Schools</h3>
            <span className="text-xs text-portal-accent/80">View all &rarr;</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-semibold text-portal-rose opacity-85 font-[family-name:var(--font-space-mono)]">
                {schools.filter(s => s.category === 'reach').length}
              </p>
              <p className="text-xs text-portal-muted">Reach</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-portal-amber opacity-85 font-[family-name:var(--font-space-mono)]">
                {schools.filter(s => s.category === 'target').length}
              </p>
              <p className="text-xs text-portal-muted">Target</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-portal-green opacity-85 font-[family-name:var(--font-space-mono)]">
                {schools.filter(s => s.category === 'safety').length}
              </p>
              <p className="text-xs text-portal-muted">Safety</p>
            </div>
          </div>
          {overdueTasks.length > 0 && (
            <p className="text-xs text-portal-rose mt-3">
              <span className="bg-portal-rose/12 px-1.5 py-0.5 rounded-md">{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}</span>
            </p>
          )}
        </button>
      </div>
    </div>
  );
}
