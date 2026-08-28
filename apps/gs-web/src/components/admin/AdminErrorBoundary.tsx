import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class AdminErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (this.props.onError) {
      this.props.onError(error);
    }
    console.error('Admin page error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="gs-alert gs-alert--error">
            <div className="max-w-2xl">
              <div className="gs-panel border-l-4">
                <h1>Admin Dashboard Error</h1>
                <p>
                  The page encountered an error and could not load. This may indicate:
                </p>
                <ul className="gs-input-group gs-list-tight">
                  <li>Authentication issue (CF Access token missing or expired)</li>
                  <li>API backend temporarily unavailable</li>
                  <li>Network or routing issue</li>
                  <li>Missing or misconfigured API endpoint</li>
                </ul>
                {this.state.error && (
                  <details className="gs-alert gs-alert--error">
                    <summary>
                      Error Details
                    </summary>
                    <pre className="whitespace-pre-wrap">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
                <div>
                  <button
                    onClick={() => window.location.reload()}
                    className="gs-button"
                  >
                    Reload Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default AdminErrorBoundary;
