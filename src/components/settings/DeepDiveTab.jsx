/**
 * Deep Dive Tab Component
 * 
 * Displays saved long AI responses for detailed viewing.
 * Part of the Settings page tabs.
 */

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Book, Trash2, ChevronDown, ChevronUp, Clock, MessageSquare, ArrowLeft, RefreshCw, Cloud, HardDrive } from 'lucide-react';
import { getDeepDives, getDeepDive, getDeepDivesFromSupabase, deleteDeepDive, clearAllDeepDives } from '../../services/deepDiveService';

export default function DeepDiveTab({ selectedDeepDiveId = null, onClose = null }) {
  const [deepDives, setDeepDives] = useState([]);
  const [expandedId, setExpandedId] = useState(selectedDeepDiveId);
  const [selectedDeepDive, setSelectedDeepDive] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load deep dives on mount
  useEffect(() => {
    loadDeepDives();
    
    // Listen for updates from the chat
    const handleUpdate = () => loadDeepDives();
    window.addEventListener('deep-dive-updated', handleUpdate);
    return () => window.removeEventListener('deep-dive-updated', handleUpdate);
  }, []);

  // If a specific deep dive is requested, load it
  useEffect(() => {
    if (selectedDeepDiveId) {
      const dd = getDeepDive(selectedDeepDiveId);
      if (dd) {
        setSelectedDeepDive(dd);
        setExpandedId(selectedDeepDiveId);
      }
    } else {
      setSelectedDeepDive(null);
    }
  }, [selectedDeepDiveId]);

  const loadDeepDives = async () => {
    setIsLoading(true);
    try {
      // Try Supabase first (includes cross-device sync), falls back to localStorage
      const dds = await getDeepDivesFromSupabase();
      // Sort by most recent first
      setDeepDives(dds.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      console.warn('[DeepDive] Failed to load from Supabase, using localStorage:', err);
      const dds = getDeepDives();
      setDeepDives(dds.sort((a, b) => b.createdAt - a.createdAt));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (confirm('Delete this Deep Dive?')) {
      deleteDeepDive(id);
      loadDeepDives();
      if (expandedId === id) setExpandedId(null);
      if (selectedDeepDive?.id === id) setSelectedDeepDive(null);
    }
  };

  const handleClearAll = () => {
    if (confirm('Delete all Deep Dives? This cannot be undone.')) {
      clearAllDeepDives();
      loadDeepDives();
      setExpandedId(null);
      setSelectedDeepDive(null);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // If viewing a specific deep dive (from chat link)
  if (selectedDeepDive) {
    return (
      <div style={{ minHeight: '100%', padding: '24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                padding: '8px 14px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.85)',
                fontWeight: 500,
                backdropFilter: 'blur(5px)',
                WebkitBackdropFilter: 'blur(5px)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
              }}
            >
              <ArrowLeft size={16} />
              Back to Chat
            </button>
          )}

          <div style={{
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 100%)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.08) 100%)',
              padding: '20px 24px',
              color: 'rgba(255,255,255,0.95)',
              borderBottom: '1px solid rgba(255,255,255,0.12)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Book size={20} />
                <span style={{ fontWeight: 600 }}>Deep Dive</span>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                {selectedDeepDive.title}
              </h2>
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 8, display: 'flex', gap: 16 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={14} />
                  {formatDate(selectedDeepDive.createdAt)}
                </span>
                <span>{selectedDeepDive.wordCount} words</span>
              </div>
            </div>

            {/* User Question */}
            {selectedDeepDive.userPrompt && (
              <div style={{
                padding: '16px 24px',
                background: 'rgba(0,0,0,0.15)',
                borderBottom: '1px solid rgba(255,255,255,0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                  <MessageSquare size={14} />
                  Your Question
                </div>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                  {selectedDeepDive.userPrompt}
                </p>
              </div>
            )}

            {/* Full Response */}
            <div style={{
              padding: '24px',
              maxHeight: '70vh',
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.15) transparent'
            }}>
              <div style={{
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.7,
                fontSize: 15,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({children}) => <p style={{ margin: '0 0 16px 0' }}>{children}</p>,
                    h1: ({children}) => <h1 style={{ fontSize: 22, fontWeight: 700, margin: '24px 0 12px 0', color: 'rgba(255,255,255,0.95)' }}>{children}</h1>,
                    h2: ({children}) => <h2 style={{ fontSize: 18, fontWeight: 600, margin: '20px 0 10px 0', color: 'rgba(255,255,255,0.95)' }}>{children}</h2>,
                    h3: ({children}) => <h3 style={{ fontSize: 16, fontWeight: 600, margin: '16px 0 8px 0', color: 'rgba(255,255,255,0.9)' }}>{children}</h3>,
                    ul: ({children}) => <ul style={{ margin: '12px 0', paddingLeft: 24 }}>{children}</ul>,
                    ol: ({children}) => <ol style={{ margin: '12px 0', paddingLeft: 24 }}>{children}</ol>,
                    li: ({children}) => <li style={{ margin: '6px 0', lineHeight: 1.6 }}>{children}</li>,
                    code: ({inline, children}) => inline
                      ? <code style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.95)', padding: '2px 6px', borderRadius: 4, fontSize: 13, fontFamily: 'ui-monospace, monospace' }}>{children}</code>
                      : <code style={{ display: 'block', background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 8, fontSize: 13, fontFamily: 'ui-monospace, monospace', overflowX: 'auto', margin: '12px 0', border: '1px solid rgba(255,255,255,0.1)' }}>{children}</code>,
                    pre: ({children}) => <pre style={{ background: 'rgba(0,0,0,0.25)', padding: 16, borderRadius: 8, margin: '12px 0', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}>{children}</pre>,
                    blockquote: ({children}) => <blockquote style={{ borderLeft: '3px solid rgba(255,255,255,0.3)', paddingLeft: 16, margin: '16px 0', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>{children}</blockquote>,
                    a: ({href, children}) => <a href={href} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'underline', textUnderlineOffset: 2 }}>{children}</a>,
                    strong: ({children}) => <strong style={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>{children}</strong>,
                  }}
                >
                  {selectedDeepDive.fullResponse}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100%', padding: '24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.95)' }}>
            <Book size={24} />
            Deep Dives
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={loadDeepDives}
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.85)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                cursor: isLoading ? 'wait' : 'pointer',
                fontSize: 13,
                fontWeight: 500,
                opacity: isLoading ? 0.6 : 1,
                backdropFilter: 'blur(5px)',
                WebkitBackdropFilter: 'blur(5px)',
                transition: 'all 0.15s ease'
              }}
              title="Sync from cloud"
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                }
              }}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
              Sync
            </button>
            {deepDives.length > 0 && (
              <button
                onClick={handleClearAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  background: 'rgba(239,68,68,0.15)',
                  color: 'rgba(239,68,68,0.9)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  backdropFilter: 'blur(5px)',
                  WebkitBackdropFilter: 'blur(5px)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.25)';
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239,68,68,0.15)';
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)';
                }}
              >
                <Trash2 size={14} />
                Clear All
              </button>
            )}
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 24, fontSize: 14 }}>
          Responses over 150 words are saved here for detailed reading. Click to expand.
        </p>

        {deepDives.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }}>
            <Book size={48} style={{ color: 'rgba(255,255,255,0.3)', marginBottom: 16 }} />
            <h3 style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginBottom: 8 }}>No Deep Dives Yet</h3>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, margin: 0 }}>
              When the AI gives you a detailed response (over 150 words), it will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {deepDives.map((dd) => (
              <div
                key={dd.id}
                style={{
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 100%)',
                  transition: 'all 0.2s ease',
                  boxShadow: expandedId === dd.id
                    ? '0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                    : '0 2px 8px rgba(0,0,0,0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)'
                }}
              >
                {/* Collapsed Header */}
                <div
                  onClick={() => setExpandedId(expandedId === dd.id ? null : dd.id)}
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    background: expandedId === dd.id
                      ? 'rgba(255,255,255,0.08)'
                      : 'transparent'
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.10) 100%)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Book size={18} style={{ color: 'rgba(255,255,255,0.9)' }} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)', marginBottom: 4 }}>
                      {dd.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span>{formatDate(dd.createdAt)}</span>
                      <span>{dd.wordCount} words</span>
                      {dd.synced ? (
                        <span title="Synced to cloud" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(34,197,94,0.8)' }}>
                          <Cloud size={12} />
                        </span>
                      ) : dd.syncFailed ? (
                        <span title="Sync failed - cached locally" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(245,158,11,0.8)' }}>
                          <HardDrive size={12} />
                        </span>
                      ) : dd.cached ? (
                        <span title="Cached locally (pending sync)" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.4)' }}>
                          <HardDrive size={12} />
                        </span>
                      ) : null}
                    </div>
                    {expandedId !== dd.id && (
                      <p style={{
                        margin: '8px 0 0 0',
                        fontSize: 14,
                        color: 'rgba(255,255,255,0.65)',
                        lineHeight: 1.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {dd.summary}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={(e) => handleDelete(dd.id, e)}
                      style={{
                        padding: 8,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'rgba(255,255,255,0.4)',
                        borderRadius: 6,
                        transition: 'color 0.15s ease'
                      }}
                      title="Delete"
                      onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(239,68,68,0.8)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                    >
                      <Trash2 size={16} />
                    </button>
                    {expandedId === dd.id ? (
                      <ChevronUp size={20} style={{ color: 'rgba(255,255,255,0.6)' }} />
                    ) : (
                      <ChevronDown size={20} style={{ color: 'rgba(255,255,255,0.6)' }} />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedId === dd.id && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                    {/* User Question */}
                    {dd.userPrompt && (
                      <div style={{
                        padding: '12px 20px',
                        background: 'rgba(0,0,0,0.2)',
                        borderBottom: '1px solid rgba(255,255,255,0.08)'
                      }}>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
                          Your Question
                        </div>
                        <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                          {dd.userPrompt}
                        </p>
                      </div>
                    )}

                    {/* Full Response */}
                    <div style={{ padding: '20px' }}>
                      <div style={{
                        color: 'rgba(255,255,255,0.85)',
                        lineHeight: 1.7,
                        fontSize: 15,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({children}) => <p style={{ margin: '0 0 16px 0' }}>{children}</p>,
                            h1: ({children}) => <h1 style={{ fontSize: 22, fontWeight: 700, margin: '24px 0 12px 0', color: 'rgba(255,255,255,0.95)' }}>{children}</h1>,
                            h2: ({children}) => <h2 style={{ fontSize: 18, fontWeight: 600, margin: '20px 0 10px 0', color: 'rgba(255,255,255,0.95)' }}>{children}</h2>,
                            h3: ({children}) => <h3 style={{ fontSize: 16, fontWeight: 600, margin: '16px 0 8px 0', color: 'rgba(255,255,255,0.9)' }}>{children}</h3>,
                            ul: ({children}) => <ul style={{ margin: '12px 0', paddingLeft: 24 }}>{children}</ul>,
                            ol: ({children}) => <ol style={{ margin: '12px 0', paddingLeft: 24 }}>{children}</ol>,
                            li: ({children}) => <li style={{ margin: '6px 0', lineHeight: 1.6 }}>{children}</li>,
                            code: ({inline, children}) => inline
                              ? <code style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.95)', padding: '2px 6px', borderRadius: 4, fontSize: 13, fontFamily: 'ui-monospace, monospace' }}>{children}</code>
                              : <code style={{ display: 'block', background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.9)', padding: 12, borderRadius: 8, fontSize: 13, fontFamily: 'ui-monospace, monospace', overflowX: 'auto', margin: '12px 0', border: '1px solid rgba(255,255,255,0.1)' }}>{children}</code>,
                            pre: ({children}) => <pre style={{ background: 'rgba(0,0,0,0.25)', padding: 16, borderRadius: 8, margin: '12px 0', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}>{children}</pre>,
                            blockquote: ({children}) => <blockquote style={{ borderLeft: '3px solid rgba(255,255,255,0.3)', paddingLeft: 16, margin: '16px 0', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>{children}</blockquote>,
                            a: ({href, children}) => <a href={href} target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'underline', textUnderlineOffset: 2 }}>{children}</a>,
                            strong: ({children}) => <strong style={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>{children}</strong>,
                          }}
                        >
                          {dd.fullResponse}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
