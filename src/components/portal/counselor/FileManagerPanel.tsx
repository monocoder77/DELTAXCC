'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import type { Profile, SharedFile } from '@/types/database';

export default function FileManagerPanel() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [files, setFiles] = useState<SharedFile[]>([]);
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
      if (ids.length > 0) {
        const { data: fileData } = await supabase
          .from('files')
          .select('*')
          .in('student_id', ids)
          .order('created_at', { ascending: false });
        setFiles((fileData as SharedFile[]) || []);
      }

      setLoading(false);
    }

    load();
  }, [profile?.id]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl">
        <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">File Manager</h1>
        <p className="text-portal-body text-sm mt-1.5">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-portal-text font-[family-name:var(--font-libre)]">File Manager</h1>
          <p className="text-portal-body text-sm mt-1.5">Manage shared resources and student files</p>
        </div>
        <button className="bg-portal-green hover:bg-portal-green/90 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          Upload Resource
        </button>
      </div>

      {/* Student Files */}
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-portal-heading mb-4">Student Files</h2>
        {students.length === 0 ? (
          <p className="text-sm text-portal-muted">No students assigned yet.</p>
        ) : (
          <div className="space-y-4">
            {students.map(student => {
              const studentFiles = files.filter(f => f.student_id === student.id);
              return (
                <div key={student.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-[rgba(168,85,247,0.12)] flex items-center justify-center text-portal-accent text-[10px] font-semibold">{student.avatar_initials}</div>
                    <span className="text-sm text-portal-text">{student.full_name}</span>
                    <span className="text-xs text-portal-dim">{studentFiles.length} file{studentFiles.length !== 1 ? 's' : ''}</span>
                  </div>
                  {studentFiles.length > 0 ? (
                    <div className="bg-portal-surface border border-portal-border-subtle rounded-lg overflow-hidden ml-8" style={{ boxShadow: 'var(--shadow-card)' }}>
                      {studentFiles.map((file, i) => (
                        <div key={file.id} className={`flex items-center gap-4 px-4 py-3 hover:bg-portal-hover transition-colors ${i > 0 ? 'border-t border-portal-border-subtle' : ''}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-portal-accent"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                          <span className="text-sm text-portal-text flex-1 truncate">{file.name}</span>
                          <span className="text-xs text-portal-dim font-[family-name:var(--font-space-mono)] hidden sm:inline">
                            {new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span className="text-xs text-portal-dim font-[family-name:var(--font-space-mono)]">{formatSize(file.size_bytes)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-portal-dim ml-8">No files yet</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
