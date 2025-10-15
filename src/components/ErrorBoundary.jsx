import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(24, 24, 28, 0.95)',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 100, 100, 0.3)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '48px',
                marginBottom: '16px',
              }}
            >
              ⚠️
            </div>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#fff',
                marginBottom: '12px',
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '20px',
                lineHeight: '1.5',
              }}
            >
              Agent Max encountered an unexpected error. The app will restart when you click the
              button below.
            </p>
            {this.state.error && (
              <details
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  textAlign: 'left',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontFamily: 'monospace',
                }}
              >
                <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Error details</summary>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && (
                    <div style={{ marginTop: '8px' }}>{this.state.errorInfo.componentStack}</div>
                  )}
                </div>
              </details>
            )}
            <button
              onClick={this.handleReset}
              style={{
                background: 'linear-gradient(135deg, #7aa2ff, #a8ffcf)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'transform 0.15s ease',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              Restart Agent Max
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
