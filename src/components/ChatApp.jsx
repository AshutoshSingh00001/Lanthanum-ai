import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Plus, Paperclip, Image, X, MessageSquare,
  Trash2, Menu, BookOpen, Code, Calculator, Atom, Copy, Check,
  Icon
} from 'lucide-react';
import { streamChat, STUDY_SYSTEM_PROMPT } from '../services/aiService';
import laLogo from '../assets/LA.png';

const STORAGE_KEY = 'Sonomer_conversations';

const SUGGESTIONS = [
  { icon: '📜', text: 'Explain the Indian Constitution Article 370' },
  { icon: '💻', text: 'Write a binary search algorithm in Python' },
  { icon: '🧮', text: 'Solve the integral: ∫ x² sin(x) dx' },
  { icon: '🔬', text: 'Explain quantum entanglement in simple terms' },
];

/* ────────────────────────────────────────────
   Helper: parse markdown-style code fences
   ──────────────────────────────────────────── */
function parseMessageParts(content) {
  const parts = [];
  if (!content) return parts;
  let remaining = content;
  let blockIdx = 0;
  while (remaining.length > 0) {
    const fenceStart = remaining.indexOf('```');
    if (fenceStart === -1) {
      parts.push({ type: 'text', content: remaining });
      break;
    }
    if (fenceStart > 0) {
      parts.push({ type: 'text', content: remaining.slice(0, fenceStart) });
    }
    const afterFence = remaining.slice(fenceStart + 3);
    const newlinePos = afterFence.indexOf('\n');
    let lang, codeStart;
    if (newlinePos === -1) {
      lang = afterFence.trim() || 'code';
      parts.push({ type: 'code', lang, content: '', idx: blockIdx++, streaming: true });
      break;
    } else {
      lang = afterFence.slice(0, newlinePos).trim() || 'code';
      codeStart = newlinePos + 1;
    }
    const codeContent = afterFence.slice(codeStart);
    const closingFence = codeContent.indexOf('```');
    if (closingFence === -1) {
      parts.push({ type: 'code', lang, content: codeContent, idx: blockIdx++, streaming: true });
      break;
    } else {
      parts.push({ type: 'code', lang, content: codeContent.slice(0, closingFence), idx: blockIdx++ });
      remaining = codeContent.slice(closingFence + 3);
    }
  }
  return parts;
}

/* ────────────────────────────────────────────
   Sub-component: renders formatted text + code
   ──────────────────────────────────────────── */
function MessageRenderer({ content }) {
  const [copiedIdx, setCopiedIdx] = useState(null);

  const copyCode = useCallback((text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  const renderTextWithFormatting = (text) => {
    const lines = text.split('\n');
    const html = lines
      .map((line) => {
        // Headings
        if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`;
        if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
        if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
        // Blockquote
        if (line.startsWith('> ')) return `<blockquote>${line.slice(2)}</blockquote>`;
        // List items
        if (/^[-*] /.test(line)) return `<li>${line.slice(2)}</li>`;

        // Inline formatting
        let formatted = line
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        return formatted ? `<p>${formatted}</p>` : '<br/>';
      })
      .join('');
    return html;
  };

  const parts = parseMessageParts(content);

  return (
    <div className="message-content">
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <div
              key={i}
              className="message-text-content"
              dangerouslySetInnerHTML={{ __html: renderTextWithFormatting(part.content) }}
            />
          );
        }
        // Code block
        return (
          <div key={i} className="code-block-wrapper">
            <div className="code-block-header">
              <span className="code-block-lang">{part.lang}</span>
              <button
                className={`code-block-copy ${copiedIdx === part.idx ? 'copied' : ''}`}
                onClick={() => copyCode(part.content, part.idx)}
                title="Copy code"
              >
                {copiedIdx === part.idx ? <Check size={14} /> : <Copy size={14} />}
                {copiedIdx === part.idx ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="code-block-body">
              <pre><code>{part.content}</code></pre>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────
   Sub-component: Welcome / empty state
   ──────────────────────────────────────────── */
function WelcomeState({ onSuggestionClick }) {
  return (
    <div className="welcome-container">
      <div className="welcome-logo">
        <img src={laLogo} alt="Sonomer AI" />
      </div>
      <h1 className="welcome-title">Sonomer AI</h1>
      <p className="welcome-subtitle">
        Your AI study companion for UPSC, coding, math &amp; science Using Claude OPUS 4.6 Advanced Model for Gyanvi and Ashutosh
      </p>
      <div className="welcome-suggestions">
        {SUGGESTIONS.map((s, i) => (
          <button key={i} className="suggestion-chip" onClick={() => onSuggestionClick(s.text)}>
            <span className="chip-icon">{s.icon}</span>
            <span className="chip-text">{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Main Component
   ════════════════════════════════════════════ */
export default function ChatApp() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  /* ── Persistence ────────────────────────── */
  const loadConversations = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setConversations(parsed);
        if (parsed.length > 0 && !currentConversationId) {
          setCurrentConversationId(parsed[0].id);
        }
      }
    } catch {
      // corrupted data — start fresh
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveConversations = useCallback((convs) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  /* ── Conversation helpers ───────────────── */
  const createNewConversation = useCallback(
    (subject) => {
      const newConv = {
        id: `conv_${Date.now()}`,
        title: subject ? `New ${subject.charAt(0).toUpperCase() + subject.slice(1)} Chat` : 'New Chat',
        messages: [],
        subject: subject || null,
        createdAt: new Date().toISOString(),
      };
      const updated = [newConv, ...conversations];
      setConversations(updated);
      setCurrentConversationId(newConv.id);
      saveConversations(updated);
      return newConv;
    },
    [conversations, saveConversations]
  );

  const deleteConversation = useCallback(
    (id) => {
      const updated = conversations.filter((c) => c.id !== id);
      setConversations(updated);
      if (currentConversationId === id) {
        setCurrentConversationId(updated.length > 0 ? updated[0].id : null);
      }
      saveConversations(updated);
    },
    [conversations, currentConversationId, saveConversations]
  );

  const getCurrentConversation = useCallback(
    () => conversations.find((c) => c.id === currentConversationId) || null,
    [conversations, currentConversationId]
  );

  const getCurrentMessages = useCallback(
    () => getCurrentConversation()?.messages || [],
    [getCurrentConversation]
  );

  /* ── File / Image Upload ────────────────── */
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachments((prev) => [
        ...prev,
        { id: Date.now(), name: file.name, type: file.type, data: reader.result, preview: null },
      ]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleImageUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachments((prev) => [
        ...prev,
        { id: Date.now(), name: file.name, type: file.type, data: reader.result, preview: reader.result },
      ]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  /* ── Send Message ───────────────────────── */
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    if (isLoading) return;

    // Determine the active conversation (create one if needed)
    let activeConvId = currentConversationId;
    let updatedConvs = [...conversations];

    if (!activeConvId) {
      const newConv = {
        id: `conv_${Date.now()}`,
        title: 'New Chat',
        messages: [],
        subject: null,
        createdAt: new Date().toISOString(),
      };
      updatedConvs = [newConv, ...updatedConvs];
      activeConvId = newConv.id;
      setCurrentConversationId(activeConvId);
    }

    // Build user message
    const userMessage = {
      role: 'user',
      content: text,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    // Add user message to conversation
    updatedConvs = updatedConvs.map((c) =>
      c.id === activeConvId ? { ...c, messages: [...c.messages, userMessage] } : c
    );

    // Add placeholder assistant message
    const assistantPlaceholder = { role: 'assistant', content: '', streaming: true };
    updatedConvs = updatedConvs.map((c) =>
      c.id === activeConvId ? { ...c, messages: [...c.messages, assistantPlaceholder] } : c
    );

    setConversations(updatedConvs);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const conv = updatedConvs.find((c) => c.id === activeConvId);
      const historyForApi = conv.messages.slice(0, -1); // exclude the empty placeholder

      for await (const update of streamChat(text, historyForApi, attachments)) {
        if (update.done) break;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== activeConvId) return c;
            const msgs = [...c.messages];
            const last = { ...msgs[msgs.length - 1] };
            last.content = update.fullContent;
            msgs[msgs.length - 1] = last;
            return { ...c, messages: msgs };
          })
        );
      }

      // Finalise streaming flag
      setConversations((prev) => {
        const finalConvs = prev.map((c) => {
          if (c.id !== activeConvId) return c;
          const msgs = [...c.messages];
          const last = { ...msgs[msgs.length - 1] };
          last.streaming = false;
          msgs[msgs.length - 1] = last;

          // Auto-title from first user message
          let title = c.title;
          if (title === 'New Chat' && msgs.length >= 1) {
            const firstUser = msgs.find((m) => m.role === 'user');
            if (firstUser) {
              title = firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? '…' : '');
            }
          }
          return { ...c, messages: msgs, title };
        });
        saveConversations(finalConvs);
        return finalConvs;
      });
    } catch (err) {
      console.error('Stream error:', err);
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeConvId) return c;
          const msgs = [...c.messages];
          const last = { ...msgs[msgs.length - 1] };
          last.content = last.content || 'Sorry, something went wrong. Please try again.';
          last.streaming = false;
          msgs[msgs.length - 1] = last;
          return { ...c, messages: msgs };
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, attachments, isLoading, currentConversationId, conversations, saveConversations]);

  /* ── Keyboard handling ──────────────────── */
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  /* ── Auto-resize textarea ───────────────── */
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  /* ── Auto-scroll ────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, currentConversationId]);

  /* ══════════════════════════════════════════
     JSX
     ══════════════════════════════════════════ */
  const currentMessages = getCurrentMessages();

  return (
    <div className="Sonomer-app">
      {/* Sidebar toggle (visible when sidebar is collapsed) */}
      {!sidebarOpen && (
        <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)}>
          <Menu size={20} />
        </button>
      )}

      {/* ── Sidebar ──────────────────────────── */}
      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src={laLogo} alt="Sonomer" />
            <span>Sonomer</span>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(false)}>
            <Menu size={18} />
          </button>
        </div>

        <button className="new-chat-btn" onClick={() => createNewConversation()}>
          <Plus size={16} />
          <span>New Chat</span>
        </button>

        <div className="subject-filters">
          <button className="subject-filter-btn" onClick={() => createNewConversation('upsc')}>
            <BookOpen size={14} /> UPSC
          </button>
          <button className="subject-filter-btn" onClick={() => createNewConversation('coding')}>
            <Code size={14} /> Coding
          </button>
          <button className="subject-filter-btn" onClick={() => createNewConversation('math')}>
            <Calculator size={14} /> Math
          </button>
          <button className="subject-filter-btn" onClick={() => createNewConversation('science')}>
            <Atom size={14} /> Science
          </button>
        </div>

        <div className="conversation-list">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
              onClick={() => setCurrentConversationId(conv.id)}
            >
              <MessageSquare size={14} />
              <div className="conversation-item-info">
                <span className="conversation-item-title">{conv.title}</span>
                <span className="conversation-item-date">
                  {new Date(conv.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                className="conversation-item-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main Chat Area ───────────────────── */}
      <main className="main-chat">
        <div className="chat-messages" ref={messagesContainerRef}>
          {currentMessages.length === 0 ? (
            <WelcomeState
              onSuggestionClick={(text) => {
                setInput(text);
                inputRef.current?.focus();
              }}
            />
          ) : (
            <>
              {currentMessages.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.role === 'user' ? 'user' : 'ai'}`}>
                  {msg.role === 'assistant' && (
                    <div className="message-avatar">
                      <img src={laLogo} alt="AI" />
                    </div>
                  )}
                  <div className="message-bubble">
                    {msg.role === 'user' ? (
                      <>
                        <div>{msg.content}</div>
                        {msg.attachments?.length > 0 && (
                          <div className="message-attachments">
                            {msg.attachments.map((att, j) => (
                              <div key={j} className="message-attachment">
                                {att.type.startsWith('image/') ? (
                                  <img src={att.preview} alt={att.name} />
                                ) : (
                                  <span>📎 {att.name}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <MessageRenderer content={msg.content} />
                    )}
                  </div>
                </div>
              ))}
              {isLoading &&
                currentMessages.length > 0 &&
                currentMessages[currentMessages.length - 1]?.content === '' && (
                  <div className="chat-message ai">
                    <div className="message-avatar">
                      <img src={laLogo} alt="AI" />
                    </div>
                    <div className="message-bubble">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Area ─────────────────────── */}
        <div className="chat-input-area">
          {attachments.length > 0 && (
            <div className="attachment-previews">
              {attachments.map((att) => (
                <div key={att.id} className="attachment-chip">
                  {att.type.startsWith('image/') ? (
                    <img src={att.preview} alt={att.name} />
                  ) : (
                    <span>📎 {att.name}</span>
                  )}
                  <button className="remove-attachment" onClick={() => removeAttachment(att.id)}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="chat-input-wrapper">
            <div className="input-actions">
              <label className="upload-btn" title="Attach file">
                <Paperclip size={18} />
                <input
                  type="file"
                  accept=".pdf,.txt,.doc,.docx,.csv"
                  onChange={handleFileUpload}
                  hidden
                />
              </label>
              <label className="upload-btn" title="Upload image">
                <Image size={18} />
                <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
              </label>
            </div>

            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about UPSC, coding, math, science..."
              rows={1}
            />

            <button
              className="send-btn"
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || isLoading}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
