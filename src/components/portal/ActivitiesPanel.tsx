'use client';

import { useState, useRef } from 'react';
import { useActivities } from '@/lib/hooks';
import type { Activity } from '@/types/database';

const activityTypes = [
  'Debate/Speech', 'Academic', 'Athletics', 'Community Service',
  'Music', 'Work', 'Research', 'Career Oriented', 'Other',
];

export default function ActivitiesPanel() {
  const { activities, updateActivity, deleteActivity, addActivity, reorderActivities, setActivities } = useActivities();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const dragRef = useRef<number | null>(null);

  const handleDragStart = (idx: number) => {
    dragRef.current = idx;
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDropTargetIdx(idx);
  };

  const handleDrop = (idx: number) => {
    const from = dragRef.current;
    if (from === null || from === idx) return;
    const updated = [...activities];
    const [moved] = updated.splice(from, 1);
    updated.splice(idx, 0, moved);
    reorderActivities(updated);
    setDraggedIdx(null);
    setDropTargetIdx(null);
    dragRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDropTargetIdx(null);
    dragRef.current = null;
  };

  const handleDeleteActivity = (id: string) => {
    deleteActivity(id);
    setExpandedId(null);
  };

  const handleAddActivity = async () => {
    const newId = await addActivity();
    if (newId) setExpandedId(newId);
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Activities</h1>
          <p className="text-portal-body text-sm mt-1.5">List your extracurricular activities ({activities.length}/10)</p>
        </div>
        <div className="flex gap-2">
          <button className="text-sm font-medium px-4 py-2.5 rounded-md border border-portal-border-subtle text-portal-muted hover:text-portal-text transition-colors">
            Export PDF
          </button>
          <button
            onClick={handleAddActivity}
            disabled={activities.length >= 10}
            className="bg-portal-accent hover:bg-portal-accent/90 text-white text-sm font-medium px-4 py-2.5 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Activity
          </button>
        </div>
      </div>

      {/* Hint Banner */}
      <div className="bg-portal-accent/5 border border-portal-accent/20 rounded-lg px-4 py-3 mb-5 flex items-center gap-3">
        <span className="text-portal-accent text-lg">&#x2807;</span>
        <p className="text-xs text-portal-muted">
          Drag the <span className="text-portal-accent font-mono">&#x2807;</span> handle on the left to reorder activities. Order matters — list your most important activity first.
        </p>
      </div>

      {/* Activity List */}
      <div
        className="bg-portal-surface rounded-lg overflow-hidden border border-portal-border-subtle divide-y divide-portal-border-subtle"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {activities.map((activity, idx) => {
          const isExpanded = expandedId === activity.id;
          const isDragged = draggedIdx === idx;
          const isDropTarget = dropTargetIdx === idx && draggedIdx !== idx;

          return (
            <div
              key={activity.id}
              className={`overflow-hidden transition-all ${
                isDragged ? 'opacity-50' : isDropTarget ? 'bg-portal-accent/5' : ''
              }`}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
            >
              {/* Header */}
              <div className="flex items-center">
                {/* Drag Handle */}
                <div
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnd={handleDragEnd}
                  className="px-3 py-4 cursor-grab active:cursor-grabbing text-portal-dim hover:text-portal-muted select-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
                    <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
                    <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
                  </svg>
                </div>

                {/* Rest of header - clickable to expand */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : activity.id)}
                  className="flex-1 flex items-center gap-3 py-4 pr-5 text-left hover:bg-portal-hover transition-colors"
                >
                  <span className="text-xs text-portal-dim font-[family-name:var(--font-space-mono)] w-6 text-center">
                    #{activity.position_order}
                  </span>
                  <span className="text-sm font-medium text-portal-text flex-1 truncate">{activity.activity_name}</span>
                  <span className="text-xs text-portal-muted hidden sm:inline truncate max-w-[120px]">{activity.role}</span>
                  <span className="text-xs text-portal-dim font-[family-name:var(--font-space-mono)] hidden md:inline">
                    {activity.hours_per_week}h/wk · {activity.weeks_per_year}wk/yr
                  </span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`text-portal-dim transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>

              {/* Expanded Body */}
              {isExpanded && (
                <div className="border-t border-portal-border-subtle p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-portal-muted mb-1">Activity Name</label>
                      <input
                        value={activity.activity_name}
                        onChange={(e) => updateActivity(activity.id, { activity_name: e.target.value })}
                        className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2 text-sm text-portal-text focus:outline-none focus:border-portal-accent/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-portal-muted mb-1">Activity Type</label>
                      <select
                        value={activity.activity_type}
                        onChange={(e) => updateActivity(activity.id, { activity_type: e.target.value })}
                        className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2 text-sm text-portal-text focus:outline-none focus:border-portal-accent/50"
                      >
                        {activityTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-portal-muted mb-1">Role / Position</label>
                      <input
                        value={activity.role}
                        onChange={(e) => updateActivity(activity.id, { role: e.target.value })}
                        className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2 text-sm text-portal-text focus:outline-none focus:border-portal-accent/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-portal-muted mb-1">Organization</label>
                      <input
                        value={activity.organization}
                        onChange={(e) => updateActivity(activity.id, { organization: e.target.value })}
                        className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2 text-sm text-portal-text focus:outline-none focus:border-portal-accent/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-portal-muted mb-1">Grade Levels</label>
                      <input
                        value={activity.grade_levels}
                        onChange={(e) => updateActivity(activity.id, { grade_levels: e.target.value })}
                        placeholder="e.g., 9, 10, 11, 12"
                        className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2 text-sm text-portal-text placeholder-portal-dim focus:outline-none focus:border-portal-accent/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-portal-muted mb-1">Timing</label>
                      <input
                        value={activity.timing}
                        onChange={(e) => updateActivity(activity.id, { timing: e.target.value })}
                        placeholder="e.g., School Year, All Year, Summer"
                        className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2 text-sm text-portal-text placeholder-portal-dim focus:outline-none focus:border-portal-accent/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-portal-muted mb-1">Hours / Week</label>
                      <input
                        type="number"
                        value={activity.hours_per_week}
                        onChange={(e) => updateActivity(activity.id, { hours_per_week: parseInt(e.target.value) || 0 })}
                        className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2 text-sm text-portal-text focus:outline-none focus:border-portal-accent/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-portal-muted mb-1">Weeks / Year</label>
                      <input
                        type="number"
                        value={activity.weeks_per_year}
                        onChange={(e) => updateActivity(activity.id, { weeks_per_year: parseInt(e.target.value) || 0 })}
                        className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2 text-sm text-portal-text focus:outline-none focus:border-portal-accent/50"
                      />
                    </div>
                  </div>

                  {/* Description with character counter */}
                  <div>
                    <label className="block text-xs text-portal-muted mb-1">Description</label>
                    <textarea
                      value={activity.description}
                      onChange={(e) => updateActivity(activity.id, { description: e.target.value })}
                      maxLength={160}
                      rows={3}
                      className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-3 py-2 text-sm text-portal-text focus:outline-none focus:border-portal-accent/50 resize-none"
                    />
                    <div className="flex justify-end mt-1">
                      <span className={`text-xs font-[family-name:var(--font-space-mono)] ${
                        activity.description.length > 150
                          ? 'text-portal-rose'
                          : activity.description.length >= 130
                          ? 'text-portal-amber'
                          : 'text-portal-dim'
                      }`}>
                        {activity.description.length} / 150
                      </span>
                    </div>
                  </div>

                  {/* Footer Buttons */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => handleDeleteActivity(activity.id)}
                      className="text-xs text-portal-rose hover:text-portal-rose/80 transition-colors"
                    >
                      Delete Activity
                    </button>
                    <button
                      onClick={() => setExpandedId(null)}
                      className="text-xs font-medium px-4 py-2 rounded-lg bg-portal-accent text-white hover:bg-portal-accent/90 transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
