import { Component, type ErrorInfo, type ReactNode } from 'react';
import { userFacingMessage } from '@/lib/api/errors';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered instead of `children` after a render error. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort guard so one failing section cannot blank the whole app. Kept
 * deliberately plain: no retry loop, no logging side effects — the fallback is
 * a static recovery affordance.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // A real deployment forwards this to the error reporter (Sentry et al.).
    console.error('Unhandled render error', error, info.componentStack);
  }

  private readonly reset = () => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    if ((error as { status?: number })?.status === 403 || error.message?.includes('403')) {
      return <UnauthorizedPage />;
    }

    return (
      <div role="alert" className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-[20px] font-semibold text-ink">Something went wrong</h1>
          <p className="mt-2 text-body-sm text-ink-muted">{userFacingMessage(error)}</p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-5 rounded-[3px] border-[1.5px] border-navy bg-navy px-4 py-2 text-[13px] font-semibold text-on-navy transition-colors duration-150 hover:bg-navy-deep"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
