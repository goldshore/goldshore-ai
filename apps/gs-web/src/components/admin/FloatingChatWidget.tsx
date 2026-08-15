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
  const [isMinimized, setIsMinimized] = useState(false);
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
    }
  }, [sessions]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createNewSession = () => {
    const sessionId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: sessionId,
      title: 'New Chat',
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
        content: 'Sorry, there was an error processing your message.',
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

  const deleteSession = (sessionId: string) => {
    setSessions(sessions.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(sessions.length > 1 ? sessions[0].id : null);
    }
  };

  if (!isOpen) {
    return (
      <button
        className="gs-chat-fab"
        onClick={() => setIsOpen(true)}
        title="Open AI Assistant"
        aria-label="Open AI Assistant"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className={`gs-chat-widget ${isMinimized ? 'minimized' : ''}`}>
      <div className="gs-chat-header">
        <h3>AI Assistant</h3>
        <div className="gs-chat-controls">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="gs-chat-btn-icon"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="gs-chat-btn-icon"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="gs-chat-sidebar">
            <button
              className="gs-chat-new-btn"
              onClick={createNewSession}
            >
              + New Chat
            </button>
            <div className="gs-chat-history">
              {sessions.map(session => (
                <div
                  key={session.id}
                  className={`gs-chat-session ${currentSessionId === session.id ? 'active' : ''}`}
                  onClick={() => setCurrentSessionId(session.id)}
                >
                  <span className="gs-chat-session-title">{session.title}</span>
                  <button
                    className="gs-chat-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="gs-chat-container">
            <div className="gs-chat-messages">
              {!currentSession && (
                <div className="gs-chat-empty">
                  <p>No chat selected. Create a new one to start.</p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`gs-chat-message gs-chat-message-${msg.role}`}>
                  <div className="gs-chat-message-content">{msg.content}</div>
                </div>
              ))}
              {isLoading && (
                <div className="gs-chat-message gs-chat-message-assistant">
                  <div className="gs-chat-message-content gs-chat-loading">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {currentSession && (
              <div className="gs-chat-input-area">
                <div className="gs-chat-input-wrapper">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask Claude..."
                    disabled={isLoading}
                    className="gs-chat-input"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !inputValue.trim()}
                    className="gs-chat-send-btn"
                  >
                    {isLoading ? '⌛' : '→'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FloatingChatWidget;
