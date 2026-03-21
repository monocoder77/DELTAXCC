'use client';

import { useState } from 'react';
import { useTasks } from '@/lib/hooks';

type Filter = 'all' | 'pending' | 'completed' | 'overdue';

export default function TasksPanel() {
  const { tasks, toggleTask } = useTasks();
  const [filter, setFilter] = useState<Filter>('all');

  const now = new Date();

  const filteredTasks = tasks.filter(task => {
    if (filter === 'pending') return !task.completed;
    if (filter === 'completed') return task.completed;
    if (filter === 'overdue') return !task.completed && new Date(task.due_date) < now;
    return true;
  });

  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => !t.completed).length,
    completed: tasks.filter(t => t.completed).length,
    overdue: tasks.filter(t => !t.completed && new Date(t.due_date) < now).length,
  };

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'completed', label: 'Completed' },
    { id: 'overdue', label: 'Overdue' },
  ];

  const categoryColors: Record<string, string> = {
    Essays: 'bg-portal-accent/10 text-portal-accent/80',
    Recommendations: 'bg-portal-green/12 text-portal-green',
    Activities: 'bg-portal-amber/12 text-portal-amber',
    Testing: 'bg-portal-rose/12 text-portal-rose',
    Applications: 'bg-portal-accent/10 text-portal-accent/80',
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Tasks</h1>
          <p className="text-portal-body text-sm mt-1.5">Track your application to-dos</p>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-6 border-b border-portal-border-subtle pb-4">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
              filter === f.id
                ? 'bg-portal-accent text-white'
                : 'text-portal-muted hover:text-portal-text'
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-xs opacity-70">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-portal-muted">No tasks match this filter.</p>
        </div>
      ) : (
        <div
          className="bg-portal-surface rounded-lg overflow-hidden border border-portal-border-subtle"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          {filteredTasks.map((task, i) => {
            const isOverdue = !task.completed && new Date(task.due_date) < now;
            const catColor = categoryColors[task.category] || 'bg-portal-dim/10 text-portal-dim';

            return (
              <div
                key={task.id}
                className={`px-5 py-4 flex items-center gap-4 transition-colors hover:bg-portal-hover ${
                  i > 0 ? 'border-t border-portal-border-subtle' : ''
                } ${isOverdue ? 'border-l-2 border-l-portal-rose' : ''}`}
              >
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`w-5 h-5 rounded-sm border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                    task.completed
                      ? 'bg-portal-green border-portal-green'
                      : 'border-portal-dim hover:border-portal-accent'
                  }`}
                >
                  {task.completed && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.completed ? 'line-through text-portal-dim' : 'text-portal-text'}`}>
                    {task.title}
                  </p>
                </div>

                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${catColor} flex-shrink-0 hidden sm:inline`}>
                  {task.category}
                </span>

                <span className={`text-xs font-[family-name:var(--font-space-mono)] flex-shrink-0 ${
                  isOverdue ? 'text-portal-rose' : task.completed ? 'text-portal-dim' : 'text-portal-muted'
                }`}>
                  {isOverdue && (
                    <span className="bg-portal-rose/12 px-1.5 py-0.5 rounded-md mr-1">!</span>
                  )}
                  {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
