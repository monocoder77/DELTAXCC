'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import type { Profile, Message, Conversation } from '@/types/database';

export default function CounselorMessagesPanel() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

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

      const { data: convs } = await supabase
        .from('conversations')
        .select('*')
        .or(`consultant_id.eq.${profile!.id},student_id.in.(${studentList.map(s => s.id).join(',')})`);
      const convList = (convs as Conversation[]) || [];
      setConversations(convList);

      if (convList.length > 0) {
        const convIds = convList.map(c => c.id);
        const { data: msgs } = await supabase
          .from('messages')
          .select('*, sender:profiles(*)')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: true });
        setMessages((msgs as Message[]) || []);

        // Select first student that has a conversation
        const firstConv = convList[0];
        setSelectedStudent(firstConv.student_id);
      } else if (studentList.length > 0) {
        setSelectedStudent(studentList[0].id);
      }

      setLoading(false);

      // Realtime subscription for all conversations
      if (convList.length > 0) {
        convList.forEach(conv => {
          supabase
            .channel(`counselor-messages:${conv.id}`)
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
        });
      }
    }

    load();

    return () => {
      getSupabase().removeAllChannels();
    };
  }, [profile?.id]);

  const conv = conversations.find(c => c.student_id === selectedStudent);
  const studentMsgs = conv ? messages.filter(m => m.conversation_id === conv.id) : [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [studentMsgs.length, selectedStudent]);

  const handleSend = async () => {
    if (!input.trim() || !conv || !profile) return;
    const supabase = getSupabase();
    await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: profile.id,
      content: input,
    });
    setInput('');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-portal-muted">Loading messages...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Conversation List */}
      <div className="w-[280px] border-r border-portal-border-subtle flex-shrink-0 flex flex-col">
        <div className="px-5 py-4 border-b border-portal-border-subtle">
          <h2 className="text-lg font-semibold text-portal-text">Messages</h2>
        </div>
        <div className="flex-1 overflow-y-auto portal-scroll">
          {students.map(student => {
            const sConv = conversations.find(c => c.student_id === student.id);
            const lastMsg = sConv ? messages.filter(m => m.conversation_id === sConv.id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] : null;
            const isSelected = selectedStudent === student.id;

            return (
              <button
                key={student.id}
                onClick={() => setSelectedStudent(student.id)}
                className={`w-full text-left px-5 py-3.5 border-b border-portal-border-subtle transition-colors ${isSelected ? 'bg-portal-green/5 border-l-2 border-l-portal-green' : 'hover:bg-portal-hover'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[rgba(168,85,247,0.12)] flex items-center justify-center text-portal-accent text-xs font-semibold flex-shrink-0">
                    {student.avatar_initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-portal-text truncate">{student.full_name}</p>
                    <p className="text-xs text-portal-dim truncate">{lastMsg?.content || 'No messages yet'}</p>
                  </div>
                </div>
              </button>
            );
          })}
          {students.length === 0 && (
            <p className="text-sm text-portal-muted px-5 py-4">No students assigned.</p>
          )}
        </div>
      </div>

      {/* Chat View */}
      <div className="flex-1 flex flex-col">
        {selectedStudent ? (
          <>
            <div className="px-6 py-4 border-b border-portal-border-subtle flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[rgba(168,85,247,0.12)] flex items-center justify-center text-portal-accent text-sm font-semibold">
                {students.find(s => s.id === selectedStudent)?.avatar_initials}
              </div>
              <div>
                <h3 className="text-base font-semibold text-portal-text">{students.find(s => s.id === selectedStudent)?.full_name}</h3>
                <p className="text-xs text-portal-dim">{students.find(s => s.id === selectedStudent)?.email}</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto portal-scroll px-6 py-4 space-y-3">
              {studentMsgs.length === 0 && (
                <p className="text-sm text-portal-muted text-center py-8">No messages yet. Start the conversation.</p>
              )}
              {studentMsgs.map(msg => {
                const isMe = msg.sender_id === profile?.id;
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${isMe ? 'bg-portal-green/20 text-portal-green' : 'bg-[rgba(168,85,247,0.12)] text-portal-accent'}`}>
                      {msg.sender?.avatar_initials}
                    </div>
                    <div className={`max-w-[70%] ${isMe ? 'text-right' : ''}`}>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isMe ? 'bg-portal-green text-white rounded-tr-sm' : 'border border-portal-border-subtle text-portal-text rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                      <p className="text-[10px] text-portal-dim mt-1 font-[family-name:var(--font-space-mono)]">
                        {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-portal-border-subtle">
              <div className="flex gap-3">
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Type a message..." className="flex-1 border border-portal-border-subtle rounded-xl px-4 py-3 text-sm text-portal-text placeholder-portal-dim bg-portal-bg focus:outline-none focus:border-portal-green/50" />
                <button onClick={handleSend} disabled={!input.trim()} className="bg-portal-green hover:bg-portal-green/90 text-white px-4 py-3 rounded-xl transition-colors disabled:opacity-50">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-portal-muted">Select a student to start messaging.</p>
          </div>
        )}
      </div>
    </div>
  );
}
