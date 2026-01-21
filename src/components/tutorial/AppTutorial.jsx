/**
 * AppTutorial Component
 * Interactive tutorial that guides new users through the Agent Max UI.
 * Shows after onboarding completes, uses spotlight + tooltip pattern.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TUTORIAL_STEPS, TOTAL_STEPS } from './tutorialSteps';
import { trackTutorialStarted, trackTutorialCompleted, trackTutorialSkipped } from '../../services/analytics';
import './AppTutorial.css';

function AppTutorial({ onComplete, isExpanded }) {
  // Always start at step 0 - we'll filter out the pill step from display if expanded
  const [currentStep, setCurrentStep] = useState(0);

  // If expanded, we skip the pill step in the UI (filter it out)
  const visibleSteps = isExpanded ? TUTORIAL_STEPS.slice(1) : TUTORIAL_STEPS;
  const step = isExpanded ? TUTORIAL_STEPS[currentStep + 1] : TUTORIAL_STEPS[currentStep];
  const totalVisibleSteps = visibleSteps.length;
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [waitingForExpand, setWaitingForExpand] = useState(false);
  const observerRef = useRef(null);

  // Track tutorial start and resize window
  useEffect(() => {
    // Track that tutorial started
    trackTutorialStarted();

    const resizeForTutorial = async () => {
      try {
        // Small delay to ensure window is ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Make the window larger during tutorial so tooltip fits nicely
        const resizeWindow = window.electron?.resizeWindow || window.electronAPI?.resizeWindow;
        if (resizeWindow) {
          console.log('[Tutorial] Resizing window to 420x520');
          await resizeWindow(420, 520);
        } else {
          console.warn('[Tutorial] No resize API available');
        }
      } catch (err) {
        console.warn('[Tutorial] Failed to resize window:', err);
      }
    };

    resizeForTutorial();

    // Restore normal size when tutorial completes (handled by onComplete)
  }, []);

  // Calculate tooltip position based on target and preferred position
  const calculateTooltipPosition = useCallback((rect, position, stepConfig) => {
    if (!rect) return { top: '50%', left: '50%', arrowLeft: '50%', arrowTop: '50%' };

    const tooltipWidth = 240;
    const tooltipHeight = 160; // Approximate (smaller now)
    const padding = 12;
    const arrowOffset = 10;
    const offsetY = stepConfig?.offsetY || 0;
    const offsetX = stepConfig?.offsetX || 0;

    let top, left;

    switch (position) {
      case 'top':
        top = rect.top - tooltipHeight - arrowOffset + offsetY;
        left = rect.left + rect.width / 2 - tooltipWidth / 2 + offsetX;
        break;
      case 'bottom':
        top = rect.bottom + arrowOffset + offsetY;
        left = rect.left + rect.width / 2 - tooltipWidth / 2 + offsetX;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2 + offsetY;
        left = rect.left - tooltipWidth - arrowOffset + offsetX;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2 + offsetY;
        left = rect.right + arrowOffset + offsetX;
        break;
      default:
        top = rect.bottom + arrowOffset + offsetY;
        left = rect.left + rect.width / 2 - tooltipWidth / 2 + offsetX;
    }

    // Keep tooltip within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Store original left for arrow calculation before clamping
    const originalLeft = left;
    const originalTop = top;

    if (left < padding) left = padding;
    if (left + tooltipWidth > viewportWidth - padding) {
      left = viewportWidth - tooltipWidth - padding;
    }
    if (top < padding) top = padding;
    if (top + tooltipHeight > viewportHeight - padding) {
      top = viewportHeight - tooltipHeight - padding;
    }

    // Calculate arrow position to point at target center
    const targetCenterX = rect.left + rect.width / 2;
    const targetCenterY = rect.top + rect.height / 2;

    // Arrow position relative to tooltip
    let arrowLeft, arrowTop;

    if (position === 'top' || position === 'bottom') {
      // Horizontal arrow position - where target center is relative to tooltip left edge
      arrowLeft = Math.max(20, Math.min(tooltipWidth - 20, targetCenterX - left));
    } else {
      // Vertical arrow position
      arrowTop = Math.max(20, Math.min(tooltipHeight - 20, targetCenterY - top));
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
      arrowLeft: arrowLeft ? `${arrowLeft}px` : undefined,
      arrowTop: arrowTop ? `${arrowTop}px` : undefined,
    };
  }, []);

  // Update target element rect
  const updateTargetRect = useCallback(() => {
    if (!step?.target) return;

    const targetEl = document.querySelector(step.target);
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      const padding = step.highlightPadding || 8;
      setTargetRect({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        originalRect: rect,
      });
      setTooltipVisible(true);
    } else {
      // Target not found - might be hidden (e.g., waiting for expand)
      setTargetRect(null);
      setTooltipVisible(false);
    }
  }, [step]);

  // Watch for target element to appear/move
  useEffect(() => {
    updateTargetRect();

    // Set up mutation observer to detect when target appears
    observerRef.current = new MutationObserver(() => {
      updateTargetRect();
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    // Also update on resize
    window.addEventListener('resize', updateTargetRect);

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener('resize', updateTargetRect);
    };
  }, [currentStep, updateTargetRect]);

  // Handle waiting for pill expansion
  useEffect(() => {
    if (waitingForExpand && isExpanded) {
      // Pill has expanded, move to next step
      setWaitingForExpand(false);
      setTimeout(() => {
        goToNextStep();
      }, 300); // Small delay for animation
    }
  }, [isExpanded, waitingForExpand]);


  // Set up action listeners for current step
  useEffect(() => {
    if (!step?.action || !step?.target) return;

    const targetEl = document.querySelector(step.target);
    if (!targetEl) return;

    const handleAction = (event) => {
      if (step.action === 'click') {
        if (step.waitForExpand) {
          // For pill click, wait for expand
          setWaitingForExpand(true);
        } else {
          goToNextStep();
        }
      } else if (step.action === 'focus') {
        goToNextStep();
      }
    };

    if (step.action === 'click') {
      targetEl.addEventListener('click', handleAction);
    } else if (step.action === 'focus') {
      targetEl.addEventListener('focus', handleAction);
    }

    // Special case: send_message action listens for custom event
    if (step.action === 'send_message') {
      const handleMessageSent = () => {
        goToNextStep();
      };
      window.addEventListener('tutorial:message_sent', handleMessageSent);
      return () => {
        window.removeEventListener('tutorial:message_sent', handleMessageSent);
        targetEl.removeEventListener('click', handleAction);
        targetEl.removeEventListener('focus', handleAction);
      };
    }

    return () => {
      targetEl.removeEventListener('click', handleAction);
      targetEl.removeEventListener('focus', handleAction);
    };
  }, [currentStep, step]);

  // Navigation functions
  const goToNextStep = useCallback(() => {
    setTooltipVisible(false);
    setTimeout(() => {
      if (currentStep < totalVisibleSteps - 1) {
        setCurrentStep((prev) => prev + 1);
      } else {
        completeTutorial();
      }
    }, 150);
  }, [currentStep, totalVisibleSteps]);

  const goToPrevStep = useCallback(() => {
    if (currentStep > 0) {
      setTooltipVisible(false);
      setTimeout(() => {
        setCurrentStep((prev) => prev - 1);
      }, 150);
    }
  }, [currentStep]);

  const skipTutorial = useCallback(() => {
    trackTutorialSkipped(currentStep);
    localStorage.setItem('tutorial_completed', 'true');
    localStorage.setItem('tutorial_skipped', 'true');
    onComplete?.();
  }, [onComplete, currentStep]);

  const completeTutorial = useCallback(() => {
    trackTutorialCompleted(totalVisibleSteps);
    localStorage.setItem('tutorial_completed', 'true');
    localStorage.setItem('tutorial_completed_at', new Date().toISOString());
    onComplete?.();
  }, [onComplete, totalVisibleSteps]);

  // Render overlay with spotlight cutout
  const renderOverlay = () => {
    if (!targetRect) {
      return <div className="tutorial-overlay" />;
    }

    // Create clip-path for spotlight effect
    const { top, left, width, height } = targetRect;
    const clipPath = `polygon(
      0% 0%,
      0% 100%,
      ${left}px 100%,
      ${left}px ${top}px,
      ${left + width}px ${top}px,
      ${left + width}px ${top + height}px,
      ${left}px ${top + height}px,
      ${left}px 100%,
      100% 100%,
      100% 0%
    )`;

    // Use custom border radius if specified in step config
    const borderRadius = step?.highlightBorderRadius !== undefined
      ? step.highlightBorderRadius
      : 12; // default

    return (
      <>
        <div className="tutorial-overlay" style={{ clipPath }} />
        <div
          className={`tutorial-highlight-ring ${step?.highlight === 'pulse' ? 'extra-pulse' : ''}`}
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            borderRadius: `${borderRadius}px`,
          }}
        />
      </>
    );
  };

  // Render tooltip
  const renderTooltip = () => {
    if (!step || !targetRect) return null;

    const positionData = calculateTooltipPosition(targetRect.originalRect, step.position, step);
    const { arrowLeft, arrowTop, ...tooltipStyle } = positionData;

    // Build arrow style based on position
    const arrowStyle = {};
    if (step.position === 'top' || step.position === 'bottom') {
      arrowStyle.left = arrowLeft;
      arrowStyle.marginLeft = '-6px';
    } else {
      arrowStyle.top = arrowTop;
      arrowStyle.marginTop = '-6px';
    }

    return (
      <div
        className={`tutorial-tooltip position-${step.position} ${tooltipVisible ? 'visible' : ''}`}
        style={tooltipStyle}
      >
        <div className="tutorial-tooltip-arrow" style={arrowStyle} />

        {/* Progress dots */}
        <div className="tutorial-progress">
          {visibleSteps.map((_, index) => (
            <div
              key={index}
              className={`tutorial-progress-dot ${
                index < currentStep ? 'completed' : ''
              } ${index === currentStep ? 'active' : ''}`}
            />
          ))}
        </div>

        {/* Content */}
        <h3 className="tutorial-tooltip-title">{step.title}</h3>
        <p className="tutorial-tooltip-content">{step.content}</p>

        {/* Navigation */}
        <div className="tutorial-nav">
          <div className="tutorial-nav-left">
            <button className="tutorial-btn tutorial-btn-skip" onClick={skipTutorial}>
              Skip tutorial
            </button>
          </div>
          <div className="tutorial-nav-right" style={{ display: 'flex', gap: '8px' }}>
            <button
              className="tutorial-btn tutorial-btn-back"
              onClick={goToPrevStep}
              disabled={currentStep === 0}
            >
              Back
            </button>
            {step.isLast ? (
              <button className="tutorial-btn tutorial-btn-finish" onClick={completeTutorial}>
                Let's go!
              </button>
            ) : (
              <button className="tutorial-btn tutorial-btn-next" onClick={goToNextStep}>
                {step.action ? "I'll try it" : 'Next'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Portal to body to ensure proper z-index stacking
  return createPortal(
    <div className="tutorial-container">
      {renderOverlay()}
      {renderTooltip()}
    </div>,
    document.body
  );
}

export default AppTutorial;
