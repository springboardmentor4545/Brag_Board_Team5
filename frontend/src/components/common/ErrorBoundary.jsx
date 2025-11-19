import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info);
    this.setState({ error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 text-red-700 rounded space-y-2">
          <p className="font-semibold">Something went wrong while loading this section.</p>
          {this.state.error && (
            <details className="text-xs whitespace-pre-wrap">
              <summary className="cursor-pointer">Error details</summary>
              {this.state.error.toString()}
              {this.state.info?.componentStack && '\n' + this.state.info.componentStack}
            </details>
          )}
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null, info: null })}
            className="px-2 py-1 bg-red-600 text-white rounded text-xs"
          >Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
