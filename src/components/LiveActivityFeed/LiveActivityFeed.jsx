import React, { useEffect, useId, useState } from 'react';
import { Check, ChevronRight, Loader2, X } from 'lucide-react';
import './LiveActivityFeed.css';

const STATUS_TRANSITION_MS = 220;

function RunningDescription({ step, stepKey }) {
  const description = step?.description || 'Working...';
  const [transition, setTransition] = useState({
    current: description,
    previous: null,
    key: stepKey,
  });

  useEffect(() => {
    setTransition((currentTransition) => {
      if (currentTransition.key === stepKey && currentTransition.current === description) {
        return currentTransition;
      }

      return {
        current: description,
        previous: currentTransition.current,
        key: stepKey,
      };
    });

    const timeout = window.setTimeout(() => {
      setTransition((currentTransition) => ({
        ...currentTransition,
        previous: null,
      }));
    }, STATUS_TRANSITION_MS);

    return () => window.clearTimeout(timeout);
  }, [description, stepKey]);

  return (
    <span className="activity-status__description" aria-live="polite" aria-atomic="true">
      {transition.previous && (
        <span
          className="activity-status__description-text activity-status__description-text--exiting"
          aria-hidden="true"
        >
          {transition.previous}
        </span>
      )}
      <span
        key={`${transition.key}-${transition.current}`}
        className="activity-status__description-text activity-status__description-text--current"
      >
        {transition.current}
      </span>
    </span>
  );
}

/**
 * A compact, progressive activity summary.
 *
 * Props:
 * - activitySteps: Array of { id, status, description, technicalDetails, error }
 * - initialMessage: Optional conversational response shown above the activity summary
 */
export default function LiveActivityFeed({ activitySteps = [], initialMessage }) {
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState({});
  const historyId = useId();

  if (!activitySteps || activitySteps.length === 0) {
    return null;
  }

  let runningStepIndex = -1;
  for (let index = activitySteps.length - 1; index >= 0; index -= 1) {
    if (activitySteps[index].status === 'running') {
      runningStepIndex = index;
      break;
    }
  }

  const isRunning = runningStepIndex !== -1;
  const runningStep = isRunning ? activitySteps[runningStepIndex] : null;
  const historySteps = isRunning
    ? activitySteps.filter((step) => step.status === 'completed' || step.status === 'failed')
    : activitySteps;
  const failedStepIndex = activitySteps.findIndex((step) => step.status === 'failed');
  const hasFailed = failedStepIndex !== -1;
  const canExpandHistory = historySteps.length > 0;
  const runningStepKey = runningStep
    ? `${runningStep.id ?? runningStepIndex}-${runningStepIndex}`
    : 'idle';

  const toggleHistory = () => {
    if (canExpandHistory) {
      setIsHistoryExpanded((isExpanded) => !isExpanded);
    }
  };

  const toggleStepDetails = (stepKey) => {
    setExpandedSteps((currentSteps) => ({
      ...currentSteps,
      [stepKey]: !currentSteps[stepKey],
    }));
  };

  return (
    <div className="live-activity-feed">
      {initialMessage && <div className="live-activity-feed__intro">{initialMessage}</div>}

      <div
        className={`activity-status${hasFailed && !isRunning ? ' activity-status--failed' : ''}`}
      >
        {isRunning ? (
          <>
            <Loader2 size={12} className="activity-status__spinner" aria-hidden="true" />
            <RunningDescription step={runningStep} stepKey={runningStepKey} />
          </>
        ) : (
          <span className="activity-status__summary">
            {hasFailed ? (
              <X size={12} className="activity-status__summary-icon" aria-hidden="true" />
            ) : (
              <Check size={12} className="activity-status__summary-icon" aria-hidden="true" />
            )}
            {hasFailed
              ? `Stopped — problem on step ${failedStepIndex + 1}`
              : `Done — ${activitySteps.length} steps`}
          </span>
        )}

        {canExpandHistory && (
          <button
            type="button"
            className="activity-status__history-toggle"
            onClick={toggleHistory}
            aria-expanded={isHistoryExpanded}
            aria-controls={historyId}
            aria-label={isHistoryExpanded ? 'Hide activity history' : 'Show activity history'}
          >
            {isRunning && <span>{historySteps.length}</span>}
            <ChevronRight
              size={12}
              aria-hidden="true"
              className={`activity-chevron${isHistoryExpanded ? ' activity-chevron--open' : ''}`}
            />
          </button>
        )}
      </div>

      {canExpandHistory && (
        <div
          id={historyId}
          className={`activity-history${isHistoryExpanded ? ' activity-history--expanded' : ''}`}
          aria-hidden={!isHistoryExpanded}
        >
          <div className="activity-history__reveal">
            <div className="activity-history__timeline">
              {historySteps.map((step, index) => {
                const stepKey = String(step.id ?? `step-${index}`);
                const isFailed = step.status === 'failed';
                const technicalDetails =
                  typeof step.technicalDetails === 'string' ? step.technicalDetails.trim() : '';
                const hasTechnicalDetails = technicalDetails.length > 0;
                const areDetailsExpanded = Boolean(expandedSteps[stepKey]);

                return (
                  <div
                    key={`${stepKey}-${index}`}
                    className={`activity-history__step${isFailed ? ' activity-history__step--failed' : ''}`}
                  >
                    <span className="activity-history__marker" aria-hidden="true">
                      {isFailed ? <X size={10} /> : <Check size={10} />}
                    </span>

                    <div className="activity-history__content">
                      <div className="activity-history__main">
                        <span className="activity-history__description">
                          {step.description || 'Completed step'}
                        </span>

                        {hasTechnicalDetails && (
                          <button
                            type="button"
                            className="activity-history__details-toggle"
                            onClick={() => toggleStepDetails(stepKey)}
                            aria-expanded={areDetailsExpanded}
                          >
                            <span>details</span>
                            <ChevronRight
                              size={10}
                              aria-hidden="true"
                              className={`activity-chevron${areDetailsExpanded ? ' activity-chevron--open' : ''}`}
                            />
                          </button>
                        )}
                      </div>

                      {isFailed && step.error && (
                        <div className="activity-history__error">{step.error}</div>
                      )}

                      {hasTechnicalDetails && areDetailsExpanded && (
                        <pre className="activity-history__technical">{technicalDetails}</pre>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
