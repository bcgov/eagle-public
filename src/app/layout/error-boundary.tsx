import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from 'app/config/logging';
import { trackException } from 'app/config/telemetry';

/** React has no hook form of an error boundary, so this is the one class component in the app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  override state = { crashed: false };

  static getDerivedStateFromError(): { crashed: boolean } {
    return { crashed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    trackException(error, { componentStack: info.componentStack ?? '' });
    logger.error(error.message, 'ErrorBoundary', error);
  }

  override render(): ReactNode {
    if (!this.state.crashed) {
      return this.props.children;
    }
    return (
      <main className="container py-5">
        <h1>Something went wrong</h1>
        <p>This page could not be displayed. Reload the page, or start again from the home page.</p>
        <a href="/">Go to the home page</a>
      </main>
    );
  }
}
