import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, ArrowRight, Clock, Zap } from 'lucide-react';
import './ActivityFeed.css';

/**
 * ActivityFeed - Shows a live scrolling log of completed and current actions
 * Displays during autonomous execution to keep users entertained and informed
 * 
 * Props:
 * - activities: Array of {id, text, status: 'done'|'running'|'pending', timestamp, duration}
 * - currentAction: String describing what's happening right now
 * - startTime: Timestamp when current action started (for real-time elapsed display)
 * - compact: Boolean for compact mode (default: false)
 */
export default function ActivityFeed({ 
  activities = [], 
  currentAction = '', 
  startTime = null,
  compact = false 
}) {
  const feedRef = useRef(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Real-time elapsed time update
  useEffect(() => {
    if (!startTime || !currentAction) {
      setElapsedTime(0);
      return;
    }

    // Initial calculation
    setElapsedTime(Math.floor((Date.now() - startTime) / 1000));

    // Update every second
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, currentAction]);

  // Auto-scroll to bottom when new activities are added
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [activities, currentAction]);

  // Format time display
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Get status icon
  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'done':
        return <Check size={12} className="activity-icon done" />;
      case 'running':
        return <Loader2 size={12} className="activity-icon running spin" />;
      default:
        return <ArrowRight size={12} className="activity-icon pending" />;
    }
  };

  // If no activities and no current action, show minimal state
  if (activities.length === 0 && !currentAction) {
    return (
      <div className={`activity-feed ${compact ? 'compact' : ''}`}>
        <div className="activity-item running">
          <StatusIcon status="running" />
          <span className="activity-text">Getting ready...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`activity-feed ${compact ? 'compact' : ''}`} ref={feedRef}>
      {/* Completed activities */}
      {activities.map((activity, index) => (
        <div 
          key={activity.id || index} 
          className={`activity-item ${activity.status}`}
        >
          <StatusIcon status={activity.status} />
          <span className="activity-text">{activity.text}</span>
          {activity.duration && (
            <span className="activity-duration">({formatTime(activity.duration)})</span>
          )}
        </div>
      ))}

      {/* Current action (always at bottom) */}
      {currentAction && (
        <div className="activity-item running current">
          <StatusIcon status="running" />
          <span className="activity-text">{currentAction}</span>
          {elapsedTime > 0 && (
            <span className="activity-elapsed">
              <Clock size={10} />
              {formatTime(elapsedTime)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
