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
          <div className="min-h-screen bg-red-50 p-8">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-red-500">
                <h1 className="text-2xl font-bold text-red-800 mb-4">Admin Dashboard Error</h1>
                <p className="text-red-700 mb-4">
                  The page encountered an error and could not load. This may indicate:
                </p>
                <ul className="list-disc list-inside text-red-700 mb-4 space-y-2">
                  <li>Authentication issue (CF Access token missing or expired)</li>
                  <li>API backend temporarily unavailable</li>
                  <li>Network or routing issue</li>
                  <li>Missing or misconfigured API endpoint</li>
                </ul>
                {this.state.error && (
                  <details className="mt-6 p-4 bg-red-100 rounded border border-red-300">
                    <summary className="font-semibold text-red-900 cursor-pointer">
                      Error Details
                    </summary>
                    <pre className="mt-2 text-sm text-red-800 whitespace-pre-wrap break-words">
                      {this.state.error.message}
                    </pre>
                  </details>
                )}
                <div className="mt-6">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium"
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
