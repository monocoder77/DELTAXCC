'use client';

import { useRef, useEffect } from 'react';
import { useMessages } from '@/lib/hooks';

export default function MessagesPanel() {
  const { messages, consultant, sendMessage, senderProfile } = useMessages();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const value = inputRef.current?.value?.trim();
    if (!value) return;
    sendMessage(value);
    if (inputRef.current) inputRef.current.value = '';
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: typeof messages }[] = [];
  messages.forEach(msg => {
    const date = new Date(msg.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date, msgs: [msg] });
    }
  });

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 52px)' }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-portal-border-subtle flex items-center gap-3 flex-shrink-0 lg:py-5">
        <div className="w-10 h-10 rounded-full bg-[rgba(168,85,247,0.12)] flex items-center justify-center text-portal-accent/80 text-sm font-semibold">
          {consultant?.avatar_initials || '?'}
        </div>
        <div>
          <h2 className="text-base font-semibold text-portal-text">{consultant?.full_name || 'Your Consultant'}</h2>
          <p className="text-xs text-portal-muted">Your Consultant</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto portal-scroll px-6 py-4 space-y-6">
        {groupedMessages.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-portal-border-subtle" />
              <span className="text-[10px] text-portal-dim font-[family-name:var(--font-space-mono)]">{group.date}</span>
              <div className="flex-1 h-px bg-portal-border-subtle" />
            </div>
            <div className="space-y-3">
              {group.msgs.map(msg => {
                const isMe = msg.sender_id === senderProfile?.id;
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                      isMe ? 'bg-[rgba(94,174,145,0.12)] text-portal-green' : 'bg-[rgba(168,85,247,0.12)] text-portal-accent/80'
                    }`}>
                      {msg.sender?.avatar_initials}
                    </div>
                    <div className={`max-w-[70%] ${isMe ? 'text-right' : ''}`}>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isMe
                          ? 'bg-portal-accent text-white rounded-tr-sm'
                          : 'border border-portal-border-subtle text-portal-text rounded-tl-sm'
                      }`}>
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
          </div>
        ))}
      </div>

      {/* Input Bar */}
      <div className="px-6 py-4 border-t border-portal-border-subtle flex-shrink-0">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 border border-portal-border-subtle rounded-xl px-4 py-3 text-sm text-portal-text placeholder-portal-dim focus:outline-none focus:border-portal-accent/50 transition-colors"
          />
          <button
            onClick={handleSend}
            className="bg-portal-accent hover:bg-portal-accent/90 text-white px-4 py-3 rounded-xl transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
