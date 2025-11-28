/**
 * Deep Dive Tab Component
 * 
 * Displays saved long AI responses for detailed viewing.
 * Part of the Settings page tabs.
 */

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Book, Trash2, ChevronDown, ChevronUp, Clock, MessageSquare, ArrowLeft } from 'lucide-react';
import { getDeepDives, getDeepDive, deleteDeepDive, clearAllDeepDives } from '../../services/deepDiveService';

export default function DeepDiveTab({ selectedDeepDiveId = null, onClose = null }) {
  const [deepDives, setDeepDives] = useState([]);
  const [expandedId, setExpandedId] = useState(selectedDeepDiveId);
  const [selectedDeepDive, setSelectedDeepDive] = useState(null);

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

  const loadDeepDives = () => {
    const dds = getDeepDives();
    // Sort by most recent first
    setDeepDives(dds.sort((a, b) => b.createdAt - a.createdAt));
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
      <div style={{ background: '#fff', minHeight: '100%', padding: '24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 16,
                padding: '8px 12px',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                color: '#374151',
                fontWeight: 500
              }}
            >
              <ArrowLeft size={16} />
              Back to Chat
            </button>
          )}
          
          <div style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              padding: '20px 24px',
              color: '#fff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Book size={20} />
                <span style={{ fontWeight: 600 }}>Deep Dive</span>
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                {selectedDeepDive.title}
              </h2>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 8, display: 'flex', gap: 16 }}>
                <span><Clock size={14} style={{ display: 'inline', marginRight: 4 }} />{formatDate(selectedDeepDive.createdAt)}</span>
                <span>{selectedDeepDive.wordCount} words</span>
              </div>
            </div>

            {/* User Question */}
            {selectedDeepDive.userPrompt && (
              <div style={{
                padding: '16px 24px',
                background: '#f9fafb',
                borderBottom: '1px solid #e5e7eb'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#6b7280', fontSize: 13 }}>
                  <MessageSquare size={14} />
                  Your Question
                </div>
                <p style={{ margin: 0, color: '#374151', fontWeight: 500 }}>
                  {selectedDeepDive.userPrompt}
                </p>
              </div>
            )}

            {/* Full Response */}
            <div style={{ padding: '24px' }}>
              <div style={{ 
                color: '#374151', 
                lineHeight: 1.7, 
                fontSize: 15,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({children}) => <p style={{ margin: '0 0 16px 0' }}>{children}</p>,
                    h1: ({children}) => <h1 style={{ fontSize: 22, fontWeight: 700, margin: '24px 0 12px 0', color: '#111827' }}>{children}</h1>,
                    h2: ({children}) => <h2 style={{ fontSize: 18, fontWeight: 600, margin: '20px 0 10px 0', color: '#111827' }}>{children}</h2>,
                    h3: ({children}) => <h3 style={{ fontSize: 16, fontWeight: 600, margin: '16px 0 8px 0', color: '#111827' }}>{children}</h3>,
                    ul: ({children}) => <ul style={{ margin: '12px 0', paddingLeft: 24 }}>{children}</ul>,
                    ol: ({children}) => <ol style={{ margin: '12px 0', paddingLeft: 24 }}>{children}</ol>,
                    li: ({children}) => <li style={{ margin: '6px 0', lineHeight: 1.6 }}>{children}</li>,
                    code: ({inline, children}) => inline 
                      ? <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 13, fontFamily: 'ui-monospace, monospace' }}>{children}</code>
                      : <code style={{ display: 'block', background: '#f3f4f6', padding: 12, borderRadius: 8, fontSize: 13, fontFamily: 'ui-monospace, monospace', overflowX: 'auto', margin: '12px 0' }}>{children}</code>,
                    pre: ({children}) => <pre style={{ background: '#f3f4f6', padding: 16, borderRadius: 8, margin: '12px 0', overflowX: 'auto' }}>{children}</pre>,
                    blockquote: ({children}) => <blockquote style={{ borderLeft: '4px solid #6366f1', paddingLeft: 16, margin: '16px 0', color: '#4b5563', fontStyle: 'italic' }}>{children}</blockquote>,
                    a: ({href, children}) => <a href={href} target="_blank" rel="noreferrer" style={{ color: '#6366f1', textDecoration: 'underline' }}>{children}</a>,
                    strong: ({children}) => <strong style={{ fontWeight: 600, color: '#111827' }}>{children}</strong>,
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
    <div style={{ background: '#fff', minHeight: '100%', padding: '24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Book size={24} />
            Deep Dives
          </h1>
          {deepDives.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                background: '#fee2e2',
                color: '#dc2626',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500
              }}
            >
              <Trash2 size={14} />
              Clear All
            </button>
          )}
        </div>

        <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 14 }}>
          Responses over 150 words are saved here for detailed reading. Click to expand.
        </p>

        {deepDives.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            background: '#f9fafb',
            borderRadius: 12,
            border: '1px solid #e5e7eb'
          }}>
            <Book size={48} style={{ color: '#d1d5db', marginBottom: 16 }} />
            <h3 style={{ color: '#374151', fontWeight: 600, marginBottom: 8 }}>No Deep Dives Yet</h3>
            <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
              When the AI gives you a detailed response (over 150 words), it will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {deepDives.map((dd) => (
              <div
                key={dd.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: '#fff',
                  transition: 'box-shadow 0.2s',
                  boxShadow: expandedId === dd.id ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
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
                    background: expandedId === dd.id ? '#f9fafb' : '#fff'
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Book size={18} style={{ color: '#fff' }} />
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                      {dd.title}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 12 }}>
                      <span>{formatDate(dd.createdAt)}</span>
                      <span>{dd.wordCount} words</span>
                    </div>
                    {expandedId !== dd.id && (
                      <p style={{
                        margin: '8px 0 0 0',
                        fontSize: 14,
                        color: '#4b5563',
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
                        color: '#9ca3af',
                        borderRadius: 6
                      }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                    {expandedId === dd.id ? (
                      <ChevronUp size={20} style={{ color: '#6b7280' }} />
                    ) : (
                      <ChevronDown size={20} style={{ color: '#6b7280' }} />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedId === dd.id && (
                  <div style={{ borderTop: '1px solid #e5e7eb' }}>
                    {/* User Question */}
                    {dd.userPrompt && (
                      <div style={{
                        padding: '12px 20px',
                        background: '#f3f4f6',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                          Your Question
                        </div>
                        <p style={{ margin: 0, color: '#374151', fontWeight: 500 }}>
                          {dd.userPrompt}
                        </p>
                      </div>
                    )}
                    
                    {/* Full Response */}
                    <div style={{ padding: '20px' }}>
                      <div style={{ 
                        color: '#374151', 
                        lineHeight: 1.7, 
                        fontSize: 15,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                      }}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({children}) => <p style={{ margin: '0 0 16px 0' }}>{children}</p>,
                            h1: ({children}) => <h1 style={{ fontSize: 22, fontWeight: 700, margin: '24px 0 12px 0', color: '#111827' }}>{children}</h1>,
                            h2: ({children}) => <h2 style={{ fontSize: 18, fontWeight: 600, margin: '20px 0 10px 0', color: '#111827' }}>{children}</h2>,
                            h3: ({children}) => <h3 style={{ fontSize: 16, fontWeight: 600, margin: '16px 0 8px 0', color: '#111827' }}>{children}</h3>,
                            ul: ({children}) => <ul style={{ margin: '12px 0', paddingLeft: 24 }}>{children}</ul>,
                            ol: ({children}) => <ol style={{ margin: '12px 0', paddingLeft: 24 }}>{children}</ol>,
                            li: ({children}) => <li style={{ margin: '6px 0', lineHeight: 1.6 }}>{children}</li>,
                            code: ({inline, children}) => inline 
                              ? <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 13, fontFamily: 'ui-monospace, monospace' }}>{children}</code>
                              : <code style={{ display: 'block', background: '#f3f4f6', padding: 12, borderRadius: 8, fontSize: 13, fontFamily: 'ui-monospace, monospace', overflowX: 'auto', margin: '12px 0' }}>{children}</code>,
                            pre: ({children}) => <pre style={{ background: '#f3f4f6', padding: 16, borderRadius: 8, margin: '12px 0', overflowX: 'auto' }}>{children}</pre>,
                            blockquote: ({children}) => <blockquote style={{ borderLeft: '4px solid #6366f1', paddingLeft: 16, margin: '16px 0', color: '#4b5563', fontStyle: 'italic' }}>{children}</blockquote>,
                            a: ({href, children}) => <a href={href} target="_blank" rel="noreferrer" style={{ color: '#6366f1', textDecoration: 'underline' }}>{children}</a>,
                            strong: ({children}) => <strong style={{ fontWeight: 600, color: '#111827' }}>{children}</strong>,
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
