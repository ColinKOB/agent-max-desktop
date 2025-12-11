/**
 * React hook for pull-based autonomous execution
 * 
 * Replaces SSE streaming with desktop-local execution:
 * - Creates run via backend
 * - Desktop executor pulls and executes
 * - Polls for status updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { pullAutonomousService } from '../services/pullAutonomous';
import { logger } from '../services/logger';

export function usePullExecution() {
    const [activeRuns, setActiveRuns] = useState(new Map());
    const pollIntervalsRef = useRef(new Map());

    /**
     * Execute a message using pull-based approach
     */
    const execute = useCallback(async (message, context = {}) => {
        try {
            logger.info('[usePullExecution] Starting execution', { message });

            // Create and start run
            const tracker = await pullAutonomousService.execute(message, context);
            
            // Handle direct responses (questions, conversations, clarifications)
            // These don't create runs - the AI answered directly
            if (tracker.isDirectResponse) {
                logger.info('[usePullExecution] Direct response received', { 
                    type: tracker.type,
                    response: tracker.response?.substring(0, 50) 
                });
                
                // Return the tracker with the response - no need to poll or track
                // The UI can display the response immediately
                return {
                    ...tracker,
                    message,
                    context
                };
            }
            
            // For tasks, add to active runs for tracking
            setActiveRuns(prev => {
                const next = new Map(prev);
                next.set(tracker.runId, {
                    ...tracker,
                    message,
                    context
                });
                return next;
            });

            return tracker;

        } catch (error) {
            logger.error('[usePullExecution] Execute failed', { error: error.message });
            throw error;
        }
    }, []);

    /**
     * Start polling for run status
     */
    const startPolling = useCallback((runId, onUpdate) => {
        // Clear any existing interval for this run
        if (pollIntervalsRef.current.has(runId)) {
            clearInterval(pollIntervalsRef.current.get(runId));
        }

        // Start polling
        pullAutonomousService.pollRunStatus(runId, (status) => {
            // Update local state
            setActiveRuns(prev => {
                const next = new Map(prev);
                const existing = next.get(runId);
                if (existing) {
                    next.set(runId, { ...existing, ...status });
                }
                return next;
            });

            // Notify callback
            if (onUpdate) {
                onUpdate(status);
            }

            // Clean up if complete, failed, cancelled, or error
            if (status.status === 'complete' ||
                status.status === 'failed' ||
                status.status === 'cancelled' ||
                status.status === 'error') {
                stopPolling(runId);
            }
        });
    }, []);

    /**
     * Stop polling for a run
     */
    const stopPolling = useCallback((runId) => {
        if (pollIntervalsRef.current.has(runId)) {
            clearInterval(pollIntervalsRef.current.get(runId));
            pollIntervalsRef.current.delete(runId);
        }
    }, []);

    /**
     * Stop a running execution
     */
    const stopRun = useCallback(async (runId) => {
        try {
            await pullAutonomousService.stopRun(runId);
            
            // Remove from active runs
            setActiveRuns(prev => {
                const next = new Map(prev);
                next.delete(runId);
                return next;
            });

            // Stop polling
            stopPolling(runId);

        } catch (error) {
            logger.error('[usePullExecution] Stop failed', { runId, error: error.message });
            throw error;
        }
    }, [stopPolling]);

    /**
     * Get run details
     */
    const getRunDetails = useCallback(async (runId) => {
        try {
            return await pullAutonomousService.getRunDetails(runId);
        } catch (error) {
            logger.error('[usePullExecution] Get details failed', { runId, error: error.message });
            return null;
        }
    }, []);

    /**
     * Get step details
     */
    const getStepDetails = useCallback(async (runId, stepIndex) => {
        try {
            return await pullAutonomousService.getStepDetails(runId, stepIndex);
        } catch (error) {
            logger.error('[usePullExecution] Get step failed', { runId, stepIndex, error: error.message });
            return null;
        }
    }, []);

    /**
     * Get executor statistics
     */
    const getStats = useCallback(async () => {
        try {
            return await pullAutonomousService.getStats();
        } catch (error) {
            logger.error('[usePullExecution] Get stats failed', { error: error.message });
            return {};
        }
    }, []);

    /**
     * Resume active runs on mount
     */
    useEffect(() => {
        const resumeRuns = async () => {
            try {
                const runs = await pullAutonomousService.getActiveRuns();
                
                if (runs.length > 0) {
                    logger.info('[usePullExecution] Resuming active runs', { count: runs.length });
                    
                    const runMap = new Map();
                    runs.forEach(run => {
                        runMap.set(run.runId, run);
                    });
                    
                    setActiveRuns(runMap);
                }
            } catch (error) {
                logger.error('[usePullExecution] Resume failed', { error: error.message });
            }
        };

        resumeRuns();

        // Cleanup on unmount
        return () => {
            // Stop all polling
            pollIntervalsRef.current.forEach((interval) => {
                clearInterval(interval);
            });
            pollIntervalsRef.current.clear();
        };
    }, []);

    return {
        // Execution control
        execute,
        stopRun,
        
        // Status polling
        startPolling,
        stopPolling,
        
        // Details
        getRunDetails,
        getStepDetails,
        getStats,
        
        // State
        activeRuns: Array.from(activeRuns.values()),
        hasActiveRuns: activeRuns.size > 0
    };
}

/**
 * Hook for a single run execution with automatic polling
 */
export function useRunExecution(runId, onStatusUpdate) {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!runId) return;

        let pollInterval;

        const poll = async () => {
            try {
                const runStatus = await window.executor.getStatus(runId);
                
                if (runStatus) {
                    setStatus(runStatus);
                    setLoading(false);
                    
                    if (onStatusUpdate) {
                        onStatusUpdate(runStatus);
                    }

                    // Stop polling if complete
                    if (runStatus.status === 'complete' || 
                        runStatus.status === 'failed' || 
                        runStatus.status === 'error') {
                        if (pollInterval) {
                            clearInterval(pollInterval);
                        }
                    }
                }
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };

        // Start polling
        poll();
        pollInterval = setInterval(poll, 1000);

        return () => {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [runId, onStatusUpdate]);

    return { status, loading, error };
}
