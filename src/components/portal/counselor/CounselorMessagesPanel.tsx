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

  const selectedStudentProfile = students.find(s => s.id === selectedStudent);
  const showChatOnMobile = !!selectedStudent;

  return (
    <div className="flex" style={{ height: 'calc(100dvh - 52px)' }}>
      {/* Conversation List — hidden on mobile when chat is open */}
      <div className={`${showChatOnMobile ? 'hidden lg:flex' : 'flex'} w-full lg:w-[280px] border-r border-portal-border-subtle flex-shrink-0 flex-col`}>
        <div className="px-4 py-3 lg:px-5 lg:py-4 border-b border-portal-border-subtle">
          <h2 className="text-base lg:text-lg font-semibold text-portal-text">Messages</h2>
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
                className={`w-full text-left px-4 py-3 lg:px-5 lg:py-3.5 border-b border-portal-border-subtle transition-colors ${isSelected ? 'bg-portal-green/5 border-l-2 border-l-portal-green' : 'hover:bg-portal-hover'}`}
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
            <p className="text-sm text-portal-muted px-4 py-4">No students assigned.</p>
          )}
        </div>
      </div>

      {/* Chat View — full width on mobile */}
      <div className={`${showChatOnMobile ? 'flex' : 'hidden lg:flex'} flex-1 flex-col min-w-0`}>
        {selectedStudent ? (
          <>
            <div className="px-3 py-2.5 lg:px-6 lg:py-4 border-b border-portal-border-subtle flex items-center gap-3">
              {/* Back button on mobile */}
              <button
                onClick={() => setSelectedStudent('')}
                className="lg:hidden text-portal-muted hover:text-portal-text transition-colors p-1 -ml-1"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-[rgba(168,85,247,0.12)] flex items-center justify-center text-portal-accent text-xs lg:text-sm font-semibold">
                {selectedStudentProfile?.avatar_initials}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm lg:text-base font-semibold text-portal-text truncate">{selectedStudentProfile?.full_name}</h3>
                <p className="text-[10px] lg:text-xs text-portal-dim truncate">{selectedStudentProfile?.email}</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto portal-scroll px-3 py-3 lg:px-6 lg:py-4 space-y-2 lg:space-y-3 min-h-0">
              {studentMsgs.length === 0 && (
                <p className="text-sm text-portal-muted text-center py-8">No messages yet. Start the conversation.</p>
              )}
              {studentMsgs.map(msg => {
                const isMe = msg.sender_id === profile?.id;
                return (
                  <div key={msg.id} className={`flex gap-2 lg:gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center text-[10px] lg:text-xs font-semibold flex-shrink-0 ${isMe ? 'bg-portal-green/20 text-portal-green' : 'bg-[rgba(168,85,247,0.12)] text-portal-accent'}`}>
                      {msg.sender?.avatar_initials}
                    </div>
                    <div className={`max-w-[80%] lg:max-w-[70%] ${isMe ? 'text-right' : ''}`}>
                      <div className={`rounded-2xl px-3 py-2 lg:px-4 lg:py-2.5 text-sm leading-relaxed ${isMe ? 'bg-portal-green text-white rounded-tr-sm' : 'border border-portal-border-subtle text-portal-text rounded-tl-sm'}`}>
                        {msg.content}
                      </div>
                      <p className="text-[9px] lg:text-[10px] text-portal-dim mt-0.5 lg:mt-1 font-[family-name:var(--font-space-mono)]">
                        {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-3 py-2.5 lg:px-6 lg:py-4 border-t border-portal-border-subtle flex-shrink-0">
              <div className="flex gap-2 lg:gap-3">
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Type a message..." className="flex-1 border border-portal-border-subtle rounded-xl px-3 py-2.5 lg:px-4 lg:py-3 text-sm text-portal-text placeholder-portal-dim bg-portal-bg focus:outline-none focus:border-portal-green/50" />
                <button onClick={handleSend} disabled={!input.trim()} className="bg-portal-green hover:bg-portal-green/90 text-white px-3 py-2.5 lg:px-4 lg:py-3 rounded-xl transition-colors disabled:opacity-50">
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
