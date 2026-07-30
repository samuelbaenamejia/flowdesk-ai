import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8 dark:bg-gray-900">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
            Algo sali\u00f3 mal
          </h1>
          <p className="max-w-md text-center text-sm text-gray-600 dark:text-gray-400">
            Ocurri\u00f3 un error inesperado. Recarga la p\u00e1gina para intentarlo de nuevo.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          >
            Recargar p\u00e1gina
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
