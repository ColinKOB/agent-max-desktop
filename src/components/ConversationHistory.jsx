import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Trash2, MessageSquare, ArrowLeft, ExternalLink, Pencil, Check, X } from 'lucide-react';
import { getAllSessions, deleteSession, renameSession } from '../services/supabaseMemory';
import { conversationAPI } from '../services/api';
import { stripActionBlocks } from '../utils/formatters';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// =============================================================================
// HELPERS
// =============================================================================

function generateTitle(messages, existingTitle) {
  if (existingTitle && existingTitle !== 'Untitled Conversation') return existingTitle;
  const firstUserMsg = messages?.find(m => m.role === 'user');
  if (!firstUserMsg) return 'New Conversation';

  let text = stripActionBlocks(firstUserMsg.content || '');
  text = text.replace(/[#*_`~\[\]()]/g, '').trim();
  if (!text) return 'New Conversation';

  const firstSentence = text.match(/^[^.!?\n]+[.!?]?/)?.[0] || text;
  if (firstSentence.length <= 80) return firstSentence.trim();
  return firstSentence.substring(0, 77).replace(/\s+\S*$/, '') + '...';
}

function groupByTime(conversations) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday - 86400000);
  const startOf7Days = new Date(startOfToday - 7 * 86400000);
  const startOf30Days = new Date(startOfToday - 30 * 86400000);

  const groups = {
    'Today': [],
    'Yesterday': [],
    'Last 7 Days': [],
    'Last 30 Days': [],
    'Older': [],
  };

  for (const conv of conversations) {
    const date = new Date(conv.updated_at || conv.created_at);
    if (date >= startOfToday) groups['Today'].push(conv);
    else if (date >= startOfYesterday) groups['Yesterday'].push(conv);
    else if (date >= startOf7Days) groups['Last 7 Days'].push(conv);
    else if (date >= startOf30Days) groups['Last 30 Days'].push(conv);
    else groups['Older'].push(conv);
  }

  return Object.entries(groups)
    .filter(([, convs]) => convs.length > 0)
    .map(([label, convs]) => ({ label, conversations: convs }));
}

function getPreview(messages) {
  const firstAssistant = messages?.find(m => m.role === 'assistant');
  if (!firstAssistant) return '';
  let text = stripActionBlocks(firstAssistant.content || '');
  text = text.replace(/[#*_`~\[\]()]/g, '').replace(/\n+/g, ' ').trim();
  if (text.length <= 80) return text;
  return text.substring(0, 77).replace(/\s+\S*$/, '') + '...';
}

function formatTimeAgo(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Dark-themed markdown components for detail view
const markdownComponents = {
  p: ({ children }) => <p style={{ margin: '0 0 8px 0', lineHeight: 1.5 }}>{children}</p>,
  strong: ({ children }) => <strong style={{ fontWeight: 600, color: '#fff' }}>{children}</strong>,
  em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
  ul: ({ children }) => <ul style={{ margin: '8px 0', paddingLeft: 20 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '8px 0', paddingLeft: 20 }}>{children}</ol>,
  li: ({ children }) => <li style={{ margin: '4px 0' }}>{children}</li>,
  h1: ({ children }) => <h1 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '1em 0 0.5em 0' }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '1em 0 0.4em 0', paddingBottom: '0.25em', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.95)', margin: '0.8em 0 0.3em 0' }}>{children}</h3>,
  hr: () => <hr style={{ border: 'none', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', margin: '1em 0' }} />,
  blockquote: ({ children }) => <blockquote style={{ margin: '0.5em 0', padding: '0.4em 0.8em', borderLeft: '3px solid rgba(59,130,246,0.5)', background: 'rgba(59,130,246,0.08)', borderRadius: '0 8px 8px 0', color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' }}>{children}</blockquote>,
  code: ({ inline, children }) => inline
    ? <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 4, fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{children}</code>
    : <code style={{ display: 'block', background: 'rgba(255,255,255,0.06)', padding: 8, borderRadius: 6, fontSize: 12, overflowX: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{children}</code>,
  pre: ({ children }) => <pre style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', padding: 12, borderRadius: 8, margin: '8px 0', overflowX: 'auto' }}>{children}</pre>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" style={{ color: '#8ab4ff', textDecoration: 'underline' }}>{children}</a>,
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function ConversationHistory({ onLoadConversation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConv, setSelectedConv] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'detail'
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [hoveredId, setHoveredId] = useState(null);
  const renameInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      let sessions = [];

      if (localStorage.getItem('user_id')) {
        try {
          const all = await getAllSessions();
          if (Array.isArray(all) && all.length) sessions = all;
        } catch (err) {
          console.warn('[History] Failed to load from Supabase:', err);
        }
      }

      // API fallback
      if (!sessions.length) {
        try {
          const res = await conversationAPI.getHistory(50, 0);
          const apiConvs = res?.data?.conversations || [];
          setConversations(apiConvs);
          return;
        } catch {}
      }

      // Map sessions to conversation objects
      const convs = sessions
        .map(session => ({
          id: session.id || session.sessionId,
          sessionId: session.sessionId || session.id,
          title: generateTitle(session.messages, session.title),
          messages: session.messages || [],
          created_at: session.created_at || session.started_at,
          updated_at: session.updated_at || session.created_at,
          message_count: session.message_count || (session.messages || []).length,
        }))
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

      setConversations(convs);
    } catch (error) {
      toast.error(`Failed to load history: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Full-text search across titles and message content
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(conv => {
      if (conv.title?.toLowerCase().includes(q)) return true;
      return conv.messages?.some(m => m.content?.toLowerCase().includes(q));
    });
  }, [conversations, searchQuery]);

  const timeGroups = useMemo(() => groupByTime(filteredConversations), [filteredConversations]);

  // Actions
  const handleSelectConv = (conv) => {
    setSelectedConv(conv);
    setViewMode('detail');
  };

  const handleBack = () => {
    setViewMode('list');
    setSelectedConv(null);
  };

  const handleContinue = () => {
    if (!selectedConv) return;
    try {
      localStorage.setItem('loaded_conversation', JSON.stringify({
        id: selectedConv.id,
        sessionId: selectedConv.sessionId || selectedConv.id,
        messages: selectedConv.messages,
        title: selectedConv.title,
      }));
      toast.success('Conversation loaded - switch to Agent Max to continue');
    } catch (e) {
      toast.error('Failed to load conversation');
    }
  };

  const handleDelete = async (convId, e) => {
    e?.stopPropagation();
    if (deleteConfirm !== convId) {
      setDeleteConfirm(convId);
      return;
    }
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    try {
      await deleteSession(conv.sessionId || conv.id);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (selectedConv?.id === convId) {
        setSelectedConv(null);
        setViewMode('list');
      }
      toast.success('Conversation deleted');
    } catch (err) {
      console.error('[History] Delete failed:', err);
      toast.error('Failed to delete conversation');
    }
    setDeleteConfirm(null);
  };

  const handleCancelDelete = (e) => {
    e?.stopPropagation();
    setDeleteConfirm(null);
  };

  const handleStartRename = (conv, e) => {
    e?.stopPropagation();
    setRenamingId(conv.id);
    setRenameValue(conv.title || '');
  };

  const handleRename = async (convId) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    try {
      await renameSession(conv.sessionId || conv.id, renameValue.trim());
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, title: renameValue.trim() } : c
      ));
    } catch (err) {
      toast.error('Failed to rename');
    }
    setRenamingId(null);
  };

  // =========================================================================
  // DETAIL VIEW
  // =========================================================================
  if (viewMode === 'detail' && selectedConv) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'rgba(255,255,255,0.95)' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0',
          borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 16, flexShrink: 0,
        }}>
          <button
            onClick={handleBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
              fontSize: 13, transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.95)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.95)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedConv.title}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {selectedConv.message_count || selectedConv.messages?.length || 0} messages
            </div>
          </div>
          <button
            onClick={handleContinue}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
              background: 'rgba(59, 130, 246, 0.9)', border: 'none', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.9)'; e.currentTarget.style.transform = 'none'; }}
          >
            <ExternalLink size={14} />
            Continue
          </button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', paddingRight: 4,
          scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {selectedConv.messages?.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                  color: 'rgba(255,255,255,0.35)', marginBottom: 4,
                  paddingLeft: msg.role === 'user' ? 0 : 2,
                  paddingRight: msg.role === 'user' ? 2 : 0,
                }}>
                  {msg.role === 'user' ? 'You' : 'Max'}
                </div>
                <div style={{
                  maxWidth: msg.role === 'user' ? '85%' : '100%',
                  padding: '10px 14px',
                  borderRadius: 12,
                  ...(msg.role === 'user' ? {
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.08) 100%)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  } : {
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 12,
                  }),
                  fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.92)',
                }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {stripActionBlocks(msg.content || '')}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // LIST VIEW
  // =========================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'rgba(255,255,255,0.95)' }}>
      {/* Shimmer keyframes */}
      <style>{`@keyframes historyShimmer { 0% { opacity: 0.4; } 50% { opacity: 0.7; } 100% { opacity: 0.4; } }`}</style>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16, flexShrink: 0 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search conversations..."
          style={{
            width: '100%', padding: '10px 12px 10px 34px', borderRadius: 10,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.95)', fontSize: 13, outline: 'none',
            transition: 'border-color 0.15s', boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
              width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1, overflowY: 'auto', paddingRight: 4,
        scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent',
      }}>
        {loading ? (
          // Skeleton loading
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                padding: '14px 16px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{
                  height: 13, width: `${55 + i * 7}%`, borderRadius: 4,
                  background: 'rgba(255,255,255,0.08)',
                  animation: 'historyShimmer 1.5s ease-in-out infinite',
                  animationDelay: `${i * 0.1}s`,
                }} />
                <div style={{
                  height: 10, width: '35%', borderRadius: 4, marginTop: 10,
                  background: 'rgba(255,255,255,0.05)',
                  animation: 'historyShimmer 1.5s ease-in-out infinite',
                  animationDelay: `${i * 0.1 + 0.2}s`,
                }} />
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          // Empty state
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 20px', textAlign: 'center',
          }}>
            <MessageSquare size={40} style={{ color: 'rgba(255,255,255,0.12)', marginBottom: 16 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
              {searchQuery ? 'No matching conversations' : 'No conversations yet'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              {searchQuery ? 'Try a different search term' : 'Start chatting with Agent Max to see your history here'}
            </div>
          </div>
        ) : (
          // Time-grouped conversation list
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {timeGroups.map(group => (
              <div key={group.label}>
                <div style={{
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
                  color: 'rgba(255,255,255,0.35)', padding: '14px 4px 6px 4px',
                }}>
                  {group.label}
                </div>
                {group.conversations.map(conv => {
                  const isHovered = hoveredId === conv.id;
                  const isDeleting = deleteConfirm === conv.id;
                  const isRenaming = renamingId === conv.id;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => !isRenaming && handleSelectConv(conv)}
                      onMouseEnter={() => setHoveredId(conv.id)}
                      onMouseLeave={() => { setHoveredId(null); if (deleteConfirm === conv.id) setDeleteConfirm(null); }}
                      style={{
                        width: '100%', textAlign: 'left', display: 'block',
                        padding: '12px 14px', borderRadius: 10, marginBottom: 2,
                        background: isHovered ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isHovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                        cursor: 'pointer', transition: 'all 0.15s', color: 'inherit',
                        position: 'relative',
                      }}
                    >
                      {/* Title row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        {isRenaming ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }} onClick={e => e.stopPropagation()}>
                            <input
                              ref={renameInputRef}
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRename(conv.id);
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              onBlur={() => handleRename(conv.id)}
                              style={{
                                flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)',
                                borderRadius: 6, padding: '3px 8px', color: 'rgba(255,255,255,0.95)',
                                fontSize: 13, fontWeight: 600, outline: 'none',
                              }}
                            />
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.95)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                            }}
                            onDoubleClick={e => handleStartRename(conv, e)}
                          >
                            {conv.title}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {formatTimeAgo(conv.updated_at)}
                        </span>
                      </div>

                      {/* Preview */}
                      {getPreview(conv.messages) && (
                        <div style={{
                          fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6,
                        }}>
                          {getPreview(conv.messages)}
                        </div>
                      )}

                      {/* Bottom row: meta + actions */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MessageSquare size={10} />
                            {conv.message_count}
                          </span>
                        </div>

                        {/* Actions (visible on hover) */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          opacity: isHovered ? 1 : 0, transition: 'opacity 0.15s',
                        }}>
                          {isDeleting ? (
                            <>
                              <button
                                onClick={e => handleDelete(conv.id, e)}
                                style={{
                                  padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                                  background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)',
                                  color: '#f87171', cursor: 'pointer',
                                }}
                              >
                                Confirm
                              </button>
                              <button
                                onClick={handleCancelDelete}
                                style={{
                                  padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
                                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={e => handleStartRename(conv, e)}
                                title="Rename"
                                style={{
                                  width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                                  color: 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                onClick={e => handleDelete(conv.id, e)}
                                title="Delete"
                                style={{
                                  width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                                  color: 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
