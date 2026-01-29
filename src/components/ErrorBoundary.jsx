import { Component } from 'react';
import {
  errorLogger,
  ErrorCodes,
  ErrorSeverity,
  getFriendlyError,
  copyErrorToClipboard,
  RecoveryActions,
  AppError,
} from '../services/errorHandler';

/**
 * ErrorBoundary Component
 *
 * Catches React component errors and displays a friendly, actionable error UI.
 * Supports different error types with appropriate recovery flows:
 * - Blocking errors: Full-screen with clear next steps
 * - Recoverable errors: Clear actions to resolve the issue
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      friendlyError: null,
      copied: false,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Convert to AppError if needed
    const appError =
      error instanceof AppError
        ? error
        : new AppError(error.message, ErrorCodes.RENDER_ERROR, {
            componentStack: errorInfo?.componentStack,
          });

    // Log the error
    errorLogger.log(appError, 'ErrorBoundary', ErrorSeverity.CRITICAL);

    // Get friendly error configuration
    const friendlyError = getFriendlyError(appError);

    this.setState({
      error: appError,
      errorInfo,
      friendlyError,
    });

    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      friendlyError: null,
      copied: false,
      isRetrying: false,
    });
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ isRetrying: true });
    // Give a brief moment for visual feedback
    setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        friendlyError: null,
        copied: false,
        isRetrying: false,
      });
    }, 500);
  };

  handleCopyError = async () => {
    const success = await copyErrorToClipboard(this.state.error);
    if (success) {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  handleCheckStatus = () => {
    if (window.electron?.shell) {
      window.electron.shell.openExternal('https://status.agentmax.app');
    } else {
      window.open('https://status.agentmax.app', '_blank');
    }
  };

  handleAction = (actionKey) => {
    const action = RecoveryActions[actionKey];
    if (!action) return;

    switch (actionKey) {
      case 'retry':
        this.handleRetry();
        break;
      case 'restart':
      case 'refresh':
        this.handleReset();
        break;
      case 'copyDetails':
        this.handleCopyError();
        break;
      case 'checkStatus':
        this.handleCheckStatus();
        break;
      default:
        if (action.handler) {
          action.handler();
        }
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, friendlyError, copied, isRetrying } = this.state;

      // Use friendly error config or defaults
      const title = friendlyError?.title || 'Something went wrong';
      const message = friendlyError?.message || 'Agent Max encountered an unexpected error.';
      const suggestion =
        friendlyError?.suggestion || 'The app will restart when you click the button below.';
      const actions = friendlyError?.actions || ['restart', 'copyDetails'];

      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(24, 24, 28, 0.98)',
            padding: '20px',
            zIndex: 99999,
          }}
        >
          {/* Background pattern for visual interest */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `radial-gradient(circle at 50% 50%, rgba(122, 162, 255, 0.03) 0%, transparent 50%)`,
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 100, 100, 0.2)',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '440px',
              width: '100%',
              textAlign: 'center',
              position: 'relative',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Error icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 20px',
                borderRadius: '50%',
                background: 'rgba(255, 100, 100, 0.1)',
                border: '2px solid rgba(255, 100, 100, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255, 120, 120, 0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            {/* Title */}
            <h2
              style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#fff',
                marginBottom: '12px',
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </h2>

            {/* Message */}
            <p
              style={{
                fontSize: '15px',
                color: 'rgba(255, 255, 255, 0.8)',
                marginBottom: '16px',
                lineHeight: '1.5',
              }}
            >
              {message}
            </p>

            {/* Suggestion box */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '24px',
                textAlign: 'left',
              }}
            >
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: '6px',
                }}
              >
                What you can do:
              </p>
              <p
                style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  lineHeight: '1.5',
                  margin: 0,
                }}
              >
                {suggestion}
              </p>
            </div>

            {/* Error details (collapsible) */}
            {error && (
              <details
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '12px',
                  borderRadius: '10px',
                  marginBottom: '24px',
                  textAlign: 'left',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    marginBottom: '8px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '13px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    fontWeight: '500',
                  }}
                >
                  Technical details
                </summary>
                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '150px',
                    overflow: 'auto',
                    marginTop: '8px',
                    padding: '8px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '6px',
                  }}
                >
                  <div style={{ marginBottom: '8px', color: 'rgba(255, 150, 150, 0.8)' }}>
                    {error.code || 'RENDER_ERROR'}: {error.message || error.toString()}
                  </div>
                  {errorInfo?.componentStack && (
                    <div style={{ opacity: 0.7 }}>{errorInfo.componentStack}</div>
                  )}
                </div>
              </details>
            )}

            {/* Action buttons */}
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              {/* Primary action (restart/retry) */}
              {(actions.includes('restart') || actions.includes('retry')) && (
                <button
                  onClick={actions.includes('retry') ? this.handleRetry : this.handleReset}
                  disabled={isRetrying}
                  style={{
                    background: 'linear-gradient(135deg, #7aa2ff, #a8ffcf)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 24px',
                    color: '#1a1a1e',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isRetrying ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: isRetrying ? 0.7 : 1,
                  }}
                  onMouseDown={(e) =>
                    !isRetrying && (e.currentTarget.style.transform = 'scale(0.96)')
                  }
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {isRetrying ? (
                    <>
                      <span
                        style={{
                          display: 'inline-block',
                          width: '14px',
                          height: '14px',
                          border: '2px solid rgba(26, 26, 30, 0.3)',
                          borderTopColor: '#1a1a1e',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M23 4v6h-6" />
                        <path d="M1 20v-6h6" />
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                      </svg>
                      {actions.includes('retry') ? 'Try Again' : 'Restart Agent Max'}
                    </>
                  )}
                </button>
              )}

              {/* Check Status button */}
              {actions.includes('checkStatus') && (
                <button
                  onClick={this.handleCheckStatus}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '10px',
                    padding: '12px 20px',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')
                  }
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Check Status
                </button>
              )}

              {/* Copy Error Details button */}
              {actions.includes('copyDetails') && (
                <button
                  onClick={this.handleCopyError}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '12px 20px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                  }}
                >
                  {copied ? (
                    <>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy Error Details
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Help text */}
            <p
              style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.4)',
                marginTop: '20px',
                lineHeight: '1.5',
              }}
            >
              If this keeps happening, copy the error details and{' '}
              <a
                href="mailto:support@agentmax.app"
                style={{
                  color: 'rgba(122, 162, 255, 0.8)',
                  textDecoration: 'underline',
                }}
                onClick={(e) => {
                  e.preventDefault();
                  if (window.electron?.shell) {
                    window.electron.shell.openExternal('mailto:support@agentmax.app');
                  } else {
                    window.open('mailto:support@agentmax.app', '_blank');
                  }
                }}
              >
                contact support
              </a>
              .
            </p>
          </div>

          {/* CSS for spinner animation */}
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
