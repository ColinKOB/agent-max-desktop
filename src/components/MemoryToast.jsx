/**
 * Memory Toast Component
 * 
 * Non-intrusive toast notification for memory extraction proposals.
 * Allows users to review and confirm facts before they're saved.
 */

import React, { useState, useEffect } from 'react';
import { Check, X, AlertTriangle, Undo2 } from 'lucide-react';
import './MemoryToast.css';

const MemoryToast = ({ proposals, onApply, onDismiss, onUndo }) => {
  const [selectedProposals, setSelectedProposals] = useState([]);
  const [showUndo, setShowUndo] = useState(false);
  const [undoTimer, setUndoTimer] = useState(null);

  useEffect(() => {
    // Auto-select all non-conflict proposals
    const autoSelect = proposals
      .map((p, idx) => ({ ...p, idx }))
      .filter(p => !p.conflict)
      .map(p => p.idx);
    setSelectedProposals(autoSelect);
  }, [proposals]);

  const handleToggle = (idx) => {
    setSelectedProposals(prev => 
      prev.includes(idx)
        ? prev.filter(i => i !== idx)
        : [...prev, idx]
    );
  };

  const handleApply = () => {
    onApply(selectedProposals);
    
    // Show undo chip for 30 seconds
    setShowUndo(true);
    
    // Clear any existing timer
    if (undoTimer) clearTimeout(undoTimer);
    
    // Auto-hide after 30 seconds
    const timer = setTimeout(() => {
      setShowUndo(false);
    }, 30000);
    setUndoTimer(timer);
  };

  const handleUndo = () => {
    if (onUndo) {
      onUndo();
    }
    setShowUndo(false);
    if (undoTimer) {
      clearTimeout(undoTimer);
      setUndoTimer(null);
    }
  };

  const handleDismiss = () => {
    onDismiss();
  };

  if (showUndo) {
    return (
      <div className="memory-toast undo-toast">
        <div className="undo-content">
          <Check size={16} className="undo-icon" />
          <span>Memory saved</span>
          <button onClick={handleUndo} className="undo-button">
            <Undo2 size={14} />
            Undo
          </button>
        </div>
      </div>
    );
  }

  if (!proposals || proposals.length === 0) {
    return null;
  }

  // Separate conflicts from normal proposals
  const conflicts = proposals.filter(p => p.conflict);
  const normal = proposals.filter(p => !p.conflict);

  return (
    <div className="memory-toast">
      <div className="toast-header">
        <div className="toast-title">
          <span className="toast-icon">🧠</span>
          <span>New memory{proposals.length > 1 ? 's' : ''}?</span>
        </div>
        <button onClick={handleDismiss} className="toast-close">
          <X size={16} />
        </button>
      </div>

      <div className="toast-body">
        {/* Normal Proposals */}
        {normal.map((proposal, idx) => {
          const proposalIdx = proposals.indexOf(proposal);
          const isSelected = selectedProposals.includes(proposalIdx);
          
          return (
            <label key={proposalIdx} className={`proposal-item ${isSelected ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(proposalIdx)}
              />
              <div className="proposal-content">
                <div className="proposal-header">
                  <span className="proposal-category">{proposal.category}</span>
                  <span className="proposal-confidence">
                    {Math.round(proposal.confidence * 100)}% confident
                  </span>
                </div>
                <div className="proposal-fact">
                  <strong>{proposal.key}:</strong> {proposal.value}
                </div>
              </div>
            </label>
          );
        })}

        {/* Conflict Proposals */}
        {conflicts.map((proposal, idx) => {
          const proposalIdx = proposals.indexOf(proposal);
          const isSelected = selectedProposals.includes(proposalIdx);
          
          return (
            <label key={proposalIdx} className={`proposal-item conflict ${isSelected ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(proposalIdx)}
              />
              <div className="proposal-content">
                <div className="conflict-header">
                  <AlertTriangle size={14} className="conflict-icon" />
                  <span>Update {proposal.category}.{proposal.key}?</span>
                </div>
                
                <div className="conflict-comparison">
                  <div className="conflict-old">
                    <span className="conflict-label">Current:</span>
                    <span className="conflict-value">{proposal.conflict.existing_value}</span>
                  </div>
                  <div className="conflict-arrow">→</div>
                  <div className="conflict-new">
                    <span className="conflict-label">New:</span>
                    <span className="conflict-value">{proposal.value}</span>
                  </div>
                </div>
                
                <div className="conflict-meta">
                  Last updated: {new Date(proposal.conflict.updated_at).toLocaleDateString()}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="toast-footer">
        <button onClick={handleDismiss} className="toast-button secondary">
          Dismiss
        </button>
        <button 
          onClick={handleApply} 
          className="toast-button primary"
          disabled={selectedProposals.length === 0}
        >
          Save {selectedProposals.length > 0 ? `(${selectedProposals.length})` : ''}
        </button>
      </div>
    </div>
  );
};

export default MemoryToast;
