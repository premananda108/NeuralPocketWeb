import { useState, useRef, useEffect, useCallback } from 'react';
import { DEFAULT_SYSTEM_PROMPT } from '../constants';
import { MODELS_LIST, decodeAudioFile } from '../hooks/useGemmaModel';
import { getHistoryTurns } from '../utils/chatHelpers';

/* ─── Types ─── */
interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  imagePreview?: string;
  time: string;
  isStreaming?: boolean;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  /** Each chat has its own system prompt */
  systemPrompt: string;
}

interface ChatInterfaceProps {
  streamingText: string;
  isGenerating: boolean;
  error: string | null;
  onSendPrompt: (
    text: string,
    imageBase64?: string,
    audioRaw?: Float32Array,
    systemPrompt?: string,
    history?: { role: 'user' | 'ai'; text: string }[]
  ) => void;
  onAbort: () => void;
  onReset: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  selectedModelUrl: string;
  onSelectModel: (url: string) => void;
  onClearCache: (modelUrl?: string) => void;
}

/* ─── Helpers ─── */
const now = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const uid = () => Math.random().toString(36).slice(2);

const STORAGE_KEY = 'pic_chats_v2';

function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Try migrating from old storage key
      const oldRaw = localStorage.getItem('pic_chats_v1');
      if (oldRaw) {
        const oldChats = JSON.parse(oldRaw) as Omit<Chat, 'systemPrompt'>[];
        // Migrate: add default systemPrompt to each chat
        return oldChats.map(c => ({ ...c, systemPrompt: DEFAULT_SYSTEM_PROMPT }));
      }
      return [];
    }
    const chats = JSON.parse(raw) as Chat[];
    // Safety: ensure every chat has a systemPrompt (forward-compat)
    return chats.map(c => ({
      ...c,
      systemPrompt: c.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    }));
  } catch { return []; }
}

function saveChats(chats: Chat[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); } catch { /* ignore */ }
}

function createChat(): Chat {
  return {
    id: uid(),
    title: 'New Chat',
    messages: [],
    createdAt: Date.now(),
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  };
}

/* ─── Icons ─── */
const IconMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const IconPlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconSend = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
);
const IconStop = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2"/>
  </svg>
);
const IconAttach = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
  </svg>
);
const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconTrash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const IconSun = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const IconMoon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
  </svg>
);
const IconEdit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

/* ─── Markdown renderer ─── */
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    if (line.startsWith('### '))     elements.push(<h3 key={i}>{processInline(line.slice(4))}</h3>);
    else if (line.startsWith('## ')) elements.push(<h2 key={i}>{processInline(line.slice(3))}</h2>);
    else if (line.startsWith('# '))  elements.push(<h1 key={i}>{processInline(line.slice(2))}</h1>);
    else if (line.startsWith('- ') || line.startsWith('* ')) elements.push(<li key={i}>{processInline(line.slice(2))}</li>);
    else if (/^\d+\.\s/.test(line))  elements.push(<li key={i}>{processInline(line.replace(/^\d+\.\s/, ''))}</li>);
    else if (line.startsWith('> '))  elements.push(<blockquote key={i}>{processInline(line.slice(2))}</blockquote>);
    else if (line.trim() === '')     elements.push(<br key={i} />);
    else                             elements.push(<p key={i}>{processInline(line)}</p>);
  });
  return <>{elements}</>;
}

function processInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const codeParts = part.split(/(`[^`]+`)/g);
    return codeParts.map((cp, j) => {
      if (cp.startsWith('`') && cp.endsWith('`')) return <code key={`${i}-${j}`}>{cp.slice(1, -1)}</code>;
      return cp;
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   DRAWER
   ═══════════════════════════════════════════════════════════ */
function Drawer({
  chats, activeChatId, onSelectChat, onNewChat, onDeleteChat,
  isDark, onToggleTheme, onClose,
  selectedModelUrl, onSelectModel, onClearCache,
  contextDepth, onContextDepthChange,
}: {
  chats: Chat[];
  activeChatId: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onClose: () => void;
  selectedModelUrl: string;
  onSelectModel: (url: string) => void;
  onClearCache: (modelUrl?: string) => void;
  contextDepth: number;
  onContextDepthChange: (val: number) => void;
}) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        {/* header */}
        <div className="drawer-header">
          <img
            src="/apple-touch-icon.png"
            alt="NeuralPocket Logo"
            className="drawer-avatar"
            style={{ objectFit: 'cover' }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>NeuralPocket</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>On-device AI · Gemma 4</div>
          </div>
        </div>

        {/* Scrollable body wrapper to prevent any elements from being squeezed */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* new chat */}
          <div style={{ padding: '12px 12px 4px', flexShrink: 0 }}>
            <button
              onClick={() => { onNewChat(); onClose(); }}
              style={{
                width: '100%', background: 'rgba(42,171,238,0.12)', color: '#2AABEE',
                border: '1px solid rgba(42,171,238,0.25)', borderRadius: 10,
                padding: '10px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
                justifyContent: 'center', transition: 'background 0.2s',
              }}
            >
              <IconPlus /> New Chat
            </button>
          </div>

          <div className="divider" style={{ margin: '8px 0', flexShrink: 0 }} />

          {/* chat list */}
          <div style={{ padding: '4px 0', flexShrink: 0 }}>
            {chats.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', marginTop: 24, padding: '0 16px' }}>
                No chats yet
              </p>
            )}
            {chats.map((chat) => {
              const lastMsg = chat.messages.filter(m => !m.isStreaming).at(-1);
              const isActive = chat.id === activeChatId;
              const hasCustomPrompt = chat.systemPrompt !== DEFAULT_SYSTEM_PROMPT;
              return (
                <div
                  key={chat.id}
                  className={`chat-list-item${isActive ? ' active' : ''}`}
                  onClick={() => { onSelectChat(chat.id); onClose(); }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="chat-list-avatar">
                    {chat.title.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontWeight: 600, fontSize: 14, color: 'var(--text-primary)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {chat.title}
                      </span>
                      {hasCustomPrompt && (
                        <span title="Custom system prompt" style={{
                          fontSize: 10, background: 'rgba(42,171,238,0.15)',
                          color: '#2AABEE', borderRadius: 4, padding: '1px 5px',
                          flexShrink: 0, fontWeight: 600,
                        }}>
                          custom
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 12, color: 'var(--text-secondary)', marginTop: 2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {lastMsg ? lastMsg.text.slice(0, 48) : 'No messages'}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-secondary)', padding: 4, borderRadius: 6,
                      opacity: 0.5, transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                    title="Delete chat"
                  >
                    <IconTrash />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="divider" style={{ flexShrink: 0 }} />

          {/* Model selection */}
          <div style={{ padding: '8px 16px', flexShrink: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8,
            }}>
              Language Model
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {MODELS_LIST.map((m) => {
                const isSelected = selectedModelUrl === m.url;
                return (
                  <button
                    key={m.id}
                    onClick={() => onSelectModel(m.url)}
                    style={{
                      background: isSelected ? 'rgba(42,171,238,0.12)' : 'transparent',
                      border: isSelected ? '1px solid rgba(42,171,238,0.3)' : '1px solid var(--divider)',
                      color: isSelected ? '#2AABEE' : 'var(--text-primary)',
                      borderRadius: 8, padding: '10px 12px', fontSize: 13,
                      fontWeight: isSelected ? 600 : 500, textAlign: 'left',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4,
                      fontFamily: 'inherit', transition: 'all 0.2s', width: '100%',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'rgba(42,171,238,0.4)';
                        e.currentTarget.style.background = 'rgba(42,171,238,0.03)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--divider)';
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: isSelected ? '#2AABEE' : 'transparent',
                          border: isSelected ? 'none' : '1px solid var(--text-secondary)',
                        }} />
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                      </div>
                      {isSelected && (
                        <span style={{ fontSize: 9, background: 'rgba(42,171,238,0.15)', color: '#2AABEE', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
                          active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 16, marginTop: 2 }}>
                      {m.description}
                    </div>
                  </button>
                );
              })}

              {/* Custom Model Card if selected URL is not in standard list */}
              {!MODELS_LIST.some(m => m.url === selectedModelUrl) && (
                <div style={{
                  background: 'rgba(42,171,238,0.12)',
                  border: '1px solid rgba(42,171,238,0.3)',
                  color: '#2AABEE',
                  borderRadius: 8, padding: '10px 12px', fontSize: 13,
                  fontWeight: 600, textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: 4,
                  width: '100%',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: '#2AABEE',
                      }} />
                      <span style={{ fontWeight: 600 }}>Custom Model</span>
                    </div>
                    <span style={{ fontSize: 9, background: 'rgba(42,171,238,0.15)', color: '#2AABEE', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
                      active
                    </span>
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 16, marginTop: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }} title={selectedModelUrl}>
                    {selectedModelUrl}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (confirm('Clear local cache for all models?')) {
                  onClearCache();
                  onClose();
                }
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: 11,
                marginTop: 8, display: 'block', fontFamily: 'inherit',
                textDecoration: 'underline', opacity: 0.7, padding: 0,
              }}
            >
              Clear downloaded files
            </button>
          </div>

          <div className="divider" style={{ flexShrink: 0 }} />

          {/* Context Memory Setting */}
          <div style={{ padding: '8px 16px', flexShrink: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8,
            }}>
              Context Memory
            </div>
            <div style={{
              background: 'var(--card-bg, rgba(255,255,255,0.03))',
              border: '1px solid var(--divider)',
              borderRadius: 10,
              padding: 12, display: 'flex', flexDirection: 'column', gap: 8
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                  Memory depth
                </span>
                <span style={{
                  fontSize: 12, background: 'rgba(42,171,238,0.15)',
                  color: '#2AABEE', padding: '2px 8px', borderRadius: 6, fontWeight: 600,
                }}>
                  {contextDepth === 0 ? 'Disabled' : `${contextDepth} turns`}
                </span>
              </div>
              <input
                type="range" min="0" max="10" value={contextDepth}
                onChange={e => onContextDepthChange(parseInt(e.target.value, 10))}
                style={{
                  width: '100%', accentColor: '#2AABEE', cursor: 'pointer',
                  background: 'var(--divider)', height: 4, borderRadius: 2, outline: 'none',
                  margin: '8px 0'
                }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                {contextDepth === 0
                  ? 'Model will only see the current message (saves RAM/speed)'
                  : `Model remembers the last ${contextDepth * 2} messages for a coherent dialogue.`}
              </div>
            </div>
          </div>

          <div className="divider" style={{ flexShrink: 0 }} />

          {/* theme toggle */}
          <div style={{
            padding: '12px 16px', display: 'flex', alignItems: 'center',
            gap: 10, color: 'var(--text-primary)', flexShrink: 0,
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {isDark ? <IconMoon /> : <IconSun />}
            </span>
            <span style={{ flex: 1, fontSize: 14 }}>{isDark ? 'Dark theme' : 'Light theme'}</span>
            <label className="theme-switch">
              <input type="checkbox" checked={isDark} onChange={onToggleTheme} />
              <span className="theme-switch-slider" />
            </label>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function ChatInterface({
  streamingText, isGenerating, error,
  onSendPrompt, onAbort, onReset,
  isDark, onToggleTheme,
  selectedModelUrl, onSelectModel, onClearCache,
}: ChatInterfaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── chats state ── */
  const [allChats, setAllChats] = useState<Chat[]>(() => {
    const saved = loadChats();
    if (saved.length > 0) return saved;
    const defaultChat = createChat();
    saveChats([defaultChat]);
    return [defaultChat];
  });
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    const saved = loadChats();
    return saved.length > 0 ? saved[0].id : '';
  });

  const [contextDepth, setContextDepth] = useState<number>(() => {
    const saved = localStorage.getItem('gemma_context_depth');
    return saved ? parseInt(saved, 10) : 5;
  });

  const handleContextDepthChange = useCallback((val: number) => {
    setContextDepth(val);
    localStorage.setItem('gemma_context_depth', val.toString());
  }, []);

  /* ── ui state ── */
  const [userText, setUserText] = useState('');
  const [pendingImage, setPendingImage] = useState<{ base64: string; preview: string } | null>(null);

  // Safe helper to update pending image state and revoke its object URL to prevent memory leaks
  const updatePendingImage = useCallback((newImage: { base64: string; preview: string } | null) => {
    setPendingImage(prev => {
      if (prev?.preview) {
        try { URL.revokeObjectURL(prev.preview); } catch { /* ignore */ }
      }
      return newImage;
    });
  }, []);

  // Cleanup pending preview object URL when the component unmounts
  useEffect(() => {
    return () => {
      setPendingImage(prev => {
        if (prev?.preview) {
          try { URL.revokeObjectURL(prev.preview); } catch { /* ignore */ }
        }
        return null;
      });
    };
  }, []);

  const [pendingAudio, setPendingAudio] = useState<{ file: File; name: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null);
  const [showSysPrompt, setShowSysPrompt] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState('');

  /* ── derived ── */
  const activeChat = allChats.find(c => c.id === activeChatId) ?? allChats[0];

  /* ── persist ── */
  useEffect(() => { saveChats(allChats); }, [allChats]);

  /* ── auto-scroll ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages, streamingText]);

  /* ── stream → source chat ── */
  useEffect(() => {
    if (!streamingId || !streamingChatId) return;
    setAllChats(prev => prev.map(chat => {
      if (chat.id !== streamingChatId) return chat;
      return {
        ...chat,
        messages: chat.messages.map(msg =>
          msg.id === streamingId
            ? { ...msg, text: streamingText, isStreaming: isGenerating }
            : msg
        ),
      };
    }));
  }, [streamingText, isGenerating, streamingId, streamingChatId]);

  /* ── auto-resize textarea ── */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [userText]);

  /* ── chat management ── */
  const updateChat = useCallback((chatId: string, updater: (c: Chat) => Chat) => {
    setAllChats(prev => prev.map(c => c.id === chatId ? updater(c) : c));
  }, []);

  const handleNewChat = useCallback(() => {
    if (isGenerating) {
      onAbort();
    }
    const chat = createChat();
    setAllChats(prev => [chat, ...prev]);
    setActiveChatId(chat.id);
    onReset();
    setStreamingId(null);
    setStreamingChatId(null);
  }, [onReset, onAbort, isGenerating]);

  const handleSelectChat = useCallback((id: string) => {
    if (isGenerating) {
      onAbort();
    }
    setActiveChatId(id);
    onReset();
    setStreamingId(null);
    setStreamingChatId(null);
  }, [onReset, onAbort, isGenerating]);

  const handleDeleteChat = useCallback((id: string) => {
    setAllChats(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0) {
        const fresh = createChat();
        setActiveChatId(fresh.id);
        return [fresh];
      }
      if (id === activeChatId) setActiveChatId(next[0].id);
      return next;
    });
  }, [activeChatId]);

  /* ── save system prompt for current chat only ── */
  const handleSaveSystemPrompt = useCallback((newPrompt: string) => {
    const final = newPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
    updateChat(activeChatId, chat => ({ ...chat, systemPrompt: final }));
    setShowSysPrompt(false);
  }, [activeChatId, updateChat]);

  /* ── file picker ── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updatePendingImage({ base64: reader.result as string, preview: URL.createObjectURL(file) });
        setPendingAudio(null); // Clear any pending audio
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i.test(file.name)) {
      setPendingAudio({ file, name: file.name });
      updatePendingImage(null); // Clear any pending image and revoke!
    }
    e.target.value = '';
  };

  /* ── send — passes current chat's systemPrompt ── */
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = userText.trim();
    if (!text && !pendingImage && !pendingAudio) return;
    if (isGenerating) return;

    const chatId = activeChatId || activeChat.id;
    const userMsgId = uid();
    const aiMsgId = uid();
    const t = now();
    const finalText = text || (pendingAudio ? `[Audio file attached: ${pendingAudio.name}]` : 'Describe what you see in this image.');

    let audioPCM: Float32Array | undefined = undefined;

    if (pendingAudio) {
      try {
        // Decode the selected audio file directly on the main thread
        audioPCM = await decodeAudioFile(pendingAudio.file);
      } catch (err: any) {
        console.error('Audio decoding error:', err);
        alert(`Failed to decode audio file: ${err?.message ?? String(err)}`);
        return;
      }
    }

    const userMsg: Message = {
      id: userMsgId, role: 'user', text: finalText,
      imagePreview: pendingImage?.base64, time: t,
    };
    const aiMsg: Message = {
      id: aiMsgId, role: 'ai', text: '', time: t, isStreaming: true,
    };

    updateChat(chatId, chat => {
      const title = chat.messages.length === 0 ? finalText.slice(0, 30) : chat.title;
      return { ...chat, title, messages: [...chat.messages, userMsg, aiMsg] };
    });

    setStreamingId(aiMsgId);
    setStreamingChatId(chatId);
    setUserText('');
    updatePendingImage(null);
    setPendingAudio(null);

    // Map current chat messages to simple role/text history, sliced by contextDepth * 2
    const history = getHistoryTurns(activeChat?.messages || [], contextDepth);

    // Pass this chat's systemPrompt, image base64, resampled audio PCM, and history to the model
    onSendPrompt(finalText, pendingImage?.base64, audioPCM, activeChat?.systemPrompt, history);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const hasCustomPrompt = activeChat && activeChat.systemPrompt !== DEFAULT_SYSTEM_PROMPT;

  /* ── render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg)' }}>
      <input
        ref={fileInputRef} type="file" accept="image/*,audio/*"
        onChange={handleFileChange} style={{ display: 'none' }} id="camera-input"
      />

      {/* Drawer */}
      {drawerOpen && (
        <Drawer
          chats={allChats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          isDark={isDark}
          onToggleTheme={onToggleTheme}
          onClose={() => setDrawerOpen(false)}
          selectedModelUrl={selectedModelUrl}
          onSelectModel={onSelectModel}
          onClearCache={onClearCache}
          contextDepth={contextDepth}
          onContextDepthChange={handleContextDepthChange}
        />
      )}

      {/* Toolbar */}
      <header className="toolbar" style={{ flexShrink: 0, zIndex: 20 }}>
        <div style={{
          maxWidth: 720, margin: '0 auto', padding: '0 8px',
          height: 56, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <button className="icon-btn" onClick={() => setDrawerOpen(true)} id="drawer-btn" aria-label="Menu">
            <IconMenu />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: 16, color: 'var(--text-primary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {activeChat?.title ?? 'NeuralPocket'}
            </div>
            <div style={{ fontSize: 12, color: isGenerating ? '#2AABEE' : 'var(--text-secondary)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              {isGenerating ? '● thinking...' : 'AI Ready · On-Device'}
              {!isGenerating && hasCustomPrompt && (
                <span style={{
                  fontSize: 10, background: 'rgba(42,171,238,0.15)',
                  color: '#2AABEE', borderRadius: 4, padding: '1px 5px', fontWeight: 600,
                }}>
                  custom prompt
                </span>
              )}
            </div>
          </div>

          {/* Edit system prompt button */}
          <button
            className="icon-btn"
            onClick={() => {
              setDraftPrompt(activeChat?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT);
              setShowSysPrompt(true);
            }}
            id="sys-prompt-btn"
            aria-label="Edit system prompt"
            title="Edit system prompt for this chat"
            style={hasCustomPrompt ? { color: '#2AABEE' } : {}}
          >
            <IconEdit />
          </button>

          <button
            className="icon-btn"
            onClick={handleNewChat}
            id="new-chat-btn"
            aria-label="New chat"
            title="New chat"
          >
            <IconPlus />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div
        className="chat-bg"
        style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}
        id="messages-area"
      >
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 8px' }}>
          {(!activeChat || activeChat.messages.length === 0) && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '60vh', gap: 12, opacity: 0.5,
            }}>
              <img
                src="/apple-touch-icon.png"
                alt="NeuralPocket Logo"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  boxShadow: '0 4px 20px rgba(42,171,238,0.15)',
                  objectFit: 'cover',
                }}
              />
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                NeuralPocket
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 260 }}>
                Ask anything, or attach a photo — your private AI is ready
              </div>
            </div>
          )}

          {activeChat?.messages.map((msg) => (
            <MessageRow key={msg.id} msg={msg} />
          ))}

          {error && (
            <div style={{
              margin: '8px 12px',
              background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.25)',
              borderRadius: 12, padding: '10px 14px', color: '#FF5252', fontSize: 13,
            }}>
              ⚠️ {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Attachment preview */}
      {pendingImage && (
        <div className="attachment-row" style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
          <div style={{ position: 'relative', width: 60, height: 60 }}>
            <img
              src={pendingImage.preview} alt="attachment"
              style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }}
            />
            <button
              onClick={() => updatePendingImage(null)}
              style={{
                position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}
            >
              <IconClose />
            </button>
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📷 Image ready to send</span>
        </div>
      )}

      {pendingAudio && (
        <div className="attachment-row" style={{ maxWidth: 720, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            position: 'relative', width: 44, height: 44, borderRadius: 10,
            background: 'rgba(42,171,238,0.12)', border: '1px solid rgba(42,171,238,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>
            🎵
            <button
              onClick={() => setPendingAudio(null)}
              style={{
                position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                borderRadius: '50%', background: 'rgba(0,0,0,0.65)', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}
            >
              <IconClose />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>
              {pendingAudio.name}
            </span>
            <span style={{ fontSize: 11, color: '#2AABEE', marginTop: 2 }}>
              🎙️ Audio track ready to transcribe
            </span>
          </div>
        </div>
      )}

      {/* Input Panel */}
      <div className="input-panel" style={{ flexShrink: 0, zIndex: 20 }}>
        <form
          onSubmit={handleSubmit}
          style={{
            maxWidth: 720, margin: '0 auto', padding: '8px 8px',
            display: 'flex', gap: 6, alignItems: 'flex-end',
          }}
        >
          <button
            type="button" className="icon-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach media" id="attach-btn"
            title="Attach image or audio file"
          >
            <IconAttach />
          </button>

          <textarea
            ref={textareaRef} id="prompt-input" className="input-field"
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={pendingImage || pendingAudio ? 'Add a message… (or just send)' : 'Ask anything, attach image or audio…'}
            rows={1} style={{ flex: 1 }} disabled={isGenerating}
          />

          {isGenerating ? (
            <button type="button" className="stop-btn" onClick={onAbort} id="abort-btn" aria-label="Stop">
              <IconStop />
            </button>
          ) : (
            <button
              type="submit" className="send-btn"
              disabled={!userText.trim() && !pendingImage && !pendingAudio}
              id="send-btn" aria-label="Send"
            >
              <IconSend />
            </button>
          )}
        </form>
      </div>

      {/* System Prompt Modal */}
      {showSysPrompt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: 16, animation: 'fade-in 0.2s ease-out both',
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--divider)',
            borderRadius: 16, width: '100%', maxWidth: 560,
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            animation: 'slide-up 0.25s ease-out both',
            maxHeight: '90vh', overflow: 'hidden',
          }}>
            {/* modal header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid var(--divider)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(42,171,238,0.15)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#2AABEE',
              }}>
                <IconEdit />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                  System Prompt
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                  For this chat only: <strong style={{ color: 'var(--text-primary)' }}>{activeChat?.title ?? 'New Chat'}</strong>
                </div>
              </div>
              <button
                onClick={() => setShowSysPrompt(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-secondary)', padding: 4, borderRadius: 6,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <IconClose />
              </button>
            </div>

            {/* textarea */}
            <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
              <textarea
                id="system-prompt-input"
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                rows={10}
                style={{
                  width: '100%', background: 'var(--input-field-bg)',
                  border: '1px solid var(--input-field-border)', borderRadius: 10,
                  color: 'var(--text-primary)', padding: '12px 14px',
                  fontSize: 14, lineHeight: 1.6, resize: 'vertical',
                  outline: 'none', fontFamily: 'inherit', minHeight: 180,
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#2AABEE')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--input-field-border)')}
                placeholder="Describe the AI's role, behavior, and response format…"
              />
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                💡 Applies only to this chat. New chats start with the default prompt. Changes take effect on the next message.
              </p>
            </div>

            {/* modal footer */}
            <div style={{
              padding: '12px 20px', borderTop: '1px solid var(--divider)',
              display: 'flex', gap: 8, justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => setDraftPrompt(DEFAULT_SYSTEM_PROMPT)}
                style={{
                  background: 'none', border: '1px solid var(--divider)',
                  borderRadius: 8, padding: '8px 14px', fontSize: 13,
                  color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#2AABEE'; e.currentTarget.style.color = '#2AABEE'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--divider)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                Reset to Default
              </button>
              <button
                onClick={() => setShowSysPrompt(false)}
                style={{
                  background: 'none', border: '1px solid var(--divider)',
                  borderRadius: 8, padding: '8px 14px', fontSize: 13,
                  color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                id="save-sys-prompt-btn"
                onClick={() => handleSaveSystemPrompt(draftPrompt)}
                style={{
                  background: '#2AABEE', border: 'none', borderRadius: 8,
                  padding: '8px 20px', fontSize: 13, fontWeight: 600,
                  color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1A8CC8')}
                onMouseLeave={e => (e.currentTarget.style.background = '#2AABEE')}
              >
                Save for This Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Message row ── */
function MessageRow({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '3px 8px', animation: 'bubble-in-right 0.2s ease-out both' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: 'min(75vw,480px)' }}>
          {msg.imagePreview && (
            <img
              src={msg.imagePreview} alt="attachment"
              style={{
                maxWidth: 200, maxHeight: 150, borderRadius: '12px 12px 4px 12px',
                objectFit: 'cover', marginBottom: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }}
            />
          )}
          <div className="bubble-user">
            <div style={{ fontSize: 15, lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.text}</div>
            <div style={{ fontSize: 11, color: 'var(--time-color)', marginTop: 4, textAlign: 'right' }}>{msg.time}</div>
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = !msg.text && msg.isStreaming;
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '3px 8px', animation: 'bubble-in-left 0.2s ease-out both' }}>
      <div className="ai-avatar">AI</div>
      <div className="bubble-ai" style={{ maxWidth: 'min(75vw,480px)' }}>
        {isEmpty ? (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '2px 0' }}>
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        ) : (
          <div
            className={`markdown-content ${msg.isStreaming ? 'streaming-cursor' : ''}`}
            style={{ fontSize: 15, lineHeight: 1.6, wordBreak: 'break-word' }}
          >
            {renderMarkdown(msg.text)}
          </div>
        )}
        {!isEmpty && (
          <div style={{ fontSize: 11, color: 'var(--time-color)', marginTop: 4 }}>{msg.time}</div>
        )}
      </div>
    </div>
  );
}
