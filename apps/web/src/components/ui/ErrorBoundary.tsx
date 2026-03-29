import React from 'react';

type Props = {
  children: React.ReactNode;
  title?: string;
};

type State = {
  hasError: boolean;
  error?: unknown;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    // Mantém no console para depuração e evita "tela branca"
    // eslint-disable-next-line no-console
    console.error('UI ErrorBoundary caught:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title || 'Falha ao renderizar a tela';
    const message =
      this.state.error instanceof Error
        ? this.state.error.message
        : 'Ocorreu um erro inesperado.';

    return (
      <div className="p-8">
        <div className="max-w-3xl rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <p className="mt-2 text-sm text-rose-100/90">{message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}

