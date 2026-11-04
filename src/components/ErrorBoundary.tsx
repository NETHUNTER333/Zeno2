import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Unhandled UI error:', error, errorInfo);
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#0a0a0a] text-neutral-100 flex items-center justify-center p-6 select-none relative overflow-hidden">
          {/* Subtle warm amber ambient glow backdrop */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-20 pointer-events-none blur-[120px]"
            style={{ backgroundColor: '#FC4C01' }}
          />

          <div className="relative z-10 max-w-md w-full bg-neutral-900/90 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl text-center space-y-6">
            <div
              className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center border shadow-lg"
              style={{
                backgroundColor: 'rgba(252, 76, 1, 0.1)',
                borderColor: 'rgba(252, 76, 1, 0.3)',
                color: '#FC4C01',
              }}
            >
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight text-white">
                Something went wrong
              </h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                An unexpected error occurred in the Kinich interface. Our diagnostics system has captured this report.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white transition-all shadow-md active:scale-95"
                style={{ backgroundColor: '#FC4C01' }}
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
