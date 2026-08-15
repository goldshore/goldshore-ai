import React, { useState, useRef, useEffect } from 'react';
import './FloatingChatWidget.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const FloatingChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  // Load sessions from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('gs-chat-sessions');
    if (saved) {
      try {
        setSessions(JSON.parse(saved));
        const lastSessionId = localStorage.getItem('gs-chat-last-session');
        if (lastSessionId) setCurrentSessionId(lastSessionId);
      } catch (e) {
        console.error('Failed to load chat sessions', e);
      }
    }
  }, []);

  // Save sessions to localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('gs-chat-sessions', JSON.stringify(sessions));
      localStorage.setItem('gs-chat-last-session', currentSessionId || '');
    }
  }, [sessions, currentSessionId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createNewSession = () => {
    const sessionId = `session-${Date.now()}`;
    const timestamp = new Date();
    const title = timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const newSession: ChatSession = {
      id: sessionId,
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(sessionId);
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || !currentSessionId || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: Date.now(),
    };

    setInputValue('');
    setIsLoading(true);

    // Update session with user message
    setSessions(sessions.map(s =>
      s.id === currentSessionId
        ? { ...s, messages: [...s.messages, userMessage], updatedAt: Date.now() }
        : s
    ));

    try {
      const response = await fetch('/api/admin/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: userMessage.content,
          context: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const data = await response.json() as { message: string };
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: Date.now(),
      };

      setSessions(sessions.map(s =>
        s.id === currentSessionId
          ? { ...s, messages: [...s.messages, assistantMessage], updatedAt: Date.now() }
          : s
      ));
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Error: Could not get response. Please try again.',
        timestamp: Date.now(),
      };
      setSessions(sessions.map(s =>
        s.id === currentSessionId
          ? { ...s, messages: [...s.messages, errorMessage], updatedAt: Date.now() }
          : s
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(sessions.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      setCurrentSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  if (!isOpen) {
    return (
      <button
        className="wp-chat-fab"
        onClick={() => setIsOpen(true)}
        title="AI Assistant"
        aria-label="Open AI Assistant"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="wp-chat-widget">
      {/* Header */}
      <div className="wp-chat-header">
        <h2 className="wp-chat-title">AI Assistant</h2>
        <button
          className="wp-chat-close"
          onClick={() => setIsOpen(false)}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Main Content */}
      <div className="wp-chat-main">
        {/* Sidebar */}
        <div className="wp-chat-sidebar">
          <button className="wp-chat-new-btn" onClick={createNewSession}>
            <span className="wp-chat-new-icon">+</span>
            <span>New Chat</span>
          </button>

          <div className="wp-chat-sessions-list">
            {sessions.length === 0 ? (
              <p className="wp-chat-empty-list">No conversations yet</p>
            ) : (
              sessions.map(session => (
                <button
                  key={session.id}
                  className={`wp-chat-session-item ${currentSessionId === session.id ? 'active' : ''}`}
                  onClick={() => setCurrentSessionId(session.id)}
                  title={session.title}
                >
                  <span className="wp-chat-session-text">{session.title}</span>
                  <button
                    className="wp-chat-delete-session"
                    onClick={(e) => deleteSession(session.id, e)}
                    aria-label="Delete conversation"
                    title="Delete"
                  >
                    ×
                  </button>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="wp-chat-content">
          {!currentSession ? (
            <div className="wp-chat-no-selection">
              <p>Select a conversation or create a new one to begin.</p>
            </div>
          ) : (
            <>
              <div className="wp-chat-messages">
                {messages.length === 0 && (
                  <div className="wp-chat-start">
                    <p>Start a conversation</p>
                  </div>
                )}
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`wp-chat-message ${msg.role === 'user' ? 'user' : 'assistant'}`}
                  >
                    <div className="wp-chat-message-label">
                      {msg.role === 'user' ? 'You' : 'Assistant'}
                    </div>
                    <div className="wp-chat-message-body">{msg.content}</div>
                  </div>
                ))}
                {isLoading && (
                  <div className="wp-chat-message assistant loading">
                    <div className="wp-chat-message-label">Assistant</div>
                    <div className="wp-chat-message-body">
                      <div className="wp-chat-loading-dots">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="wp-chat-footer">
                <div className="wp-chat-input-group">
                  <input
                    type="text"
                    className="wp-chat-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type your message..."
                    disabled={isLoading}
                  />
                  <button
                    className="wp-chat-submit"
                    onClick={sendMessage}
                    disabled={isLoading || !inputValue.trim()}
                    aria-label="Send message"
                    title="Send"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,2.89 C3.34915502,2.40 2.40734225,2.50636533 1.77946707,3.0776575 C0.994623095,3.6489497 0.837654326,4.73742330 1.15159189,5.52291022 L3.03521743,11.9639032 C3.03521743,12.1210006 3.19218622,12.2780980 3.50612381,12.2780980 L16.6915026,13.0635849 C16.6915026,13.0635849 17.1624089,13.0635849 17.1624089,12.5923188 L17.1624089,12.0210267 C17.1624089,11.5497606 16.6915026,11.4744748 16.6915026,12.4744748 Z" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FloatingChatWidget;
