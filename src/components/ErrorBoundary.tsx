import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui';

interface Props {
  children: ReactNode;
  /** Shown instead of the default screen; receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Application-level error boundary. A render failure must never leave a blank screen —
 * the user keeps a route back to their data, and nothing is reported anywhere off-device.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Local only: this never leaves the device.
    console.error('RepForge render error', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="text-3xl" aria-hidden="true">
          🛠
        </span>
        <h1 className="text-lg font-bold text-ink">Lock’d hit an unexpected error</h1>
        <p className="text-sm text-ink-muted">
          Your workouts are stored on this device and were not affected. Try again, or reload the
          app.
        </p>
        <pre className="max-h-40 w-full overflow-auto rounded border border-line bg-surface-raised p-3 text-left text-xs text-ink-muted">
          {error.message}
        </pre>
        <div className="flex gap-2">
          <Button onClick={this.reset}>Try again</Button>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}
