'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function CounselorSettingsPanel() {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.full_name || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [notifications, setNotifications] = useState({
    essay_submissions: true,
    student_messages: true,
    approaching_deadlines: true,
  });

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">Settings</h1>
        <p className="text-portal-body text-sm mt-1.5">Manage your counselor account</p>
      </div>

      <div className="bg-portal-surface border border-portal-border-subtle rounded-lg p-6 mb-6" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading mb-4">Profile</h2>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-[rgba(168,85,247,0.12)] flex items-center justify-center text-portal-accent/80 text-xl font-semibold">{profile?.avatar_initials || ''}</div>
          <div>
            <p className="text-base font-medium text-portal-text">{name}</p>
            <p className="text-sm text-portal-muted">{email}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-portal-muted mb-1">Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-4 py-2.5 text-sm text-portal-text focus:outline-none focus:border-portal-green/50" />
          </div>
          <div>
            <label className="block text-xs text-portal-muted mb-1">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-4 py-2.5 text-sm text-portal-text focus:outline-none focus:border-portal-green/50" />
          </div>
          <button className="text-sm font-medium px-4 py-2 rounded-md bg-portal-green text-white hover:bg-portal-green/90 transition-colors">Save Changes</button>
        </div>
      </div>

      <div className="bg-portal-surface border border-portal-border-subtle rounded-lg p-6 mb-6" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading mb-4">Password</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-portal-muted mb-1">Current Password</label>
            <input type="password" className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-4 py-2.5 text-sm text-portal-text focus:outline-none focus:border-portal-green/50" />
          </div>
          <div>
            <label className="block text-xs text-portal-muted mb-1">New Password</label>
            <input type="password" className="w-full bg-portal-bg border border-portal-border-subtle rounded-lg px-4 py-2.5 text-sm text-portal-text focus:outline-none focus:border-portal-green/50" />
          </div>
          <button className="text-sm font-medium px-4 py-2 rounded-md border border-portal-border-subtle text-portal-text hover:bg-portal-hover transition-colors">Update Password</button>
        </div>
      </div>

      <div className="bg-portal-surface border border-portal-border-subtle rounded-lg p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading mb-4">Notifications</h2>
        <div className="space-y-3">
          {[
            { key: 'essay_submissions' as const, label: 'Email me when a student submits an essay for review' },
            { key: 'student_messages' as const, label: 'Email me when a student sends a message' },
            { key: 'approaching_deadlines' as const, label: 'Email me about approaching deadlines (7 days out)' },
          ].map(item => (
            <label key={item.key} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-portal-muted">{item.label}</span>
              <button
                onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`w-10 h-6 rounded-full transition-colors relative ${notifications[item.key] ? 'bg-portal-green' : 'bg-portal-dim/30'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${notifications[item.key] ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
