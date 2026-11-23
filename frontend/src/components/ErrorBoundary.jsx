import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto mt-16 max-w-md rounded-panel border border-white/60 bg-white/70 p-6 text-center glass neu-raised">
        <h1 className="text-lg font-semibold text-zf-blue">Algo salió mal</h1>
        <p className="mt-2 text-sm text-text-muted">Ocurrió un error inesperado en la pantalla.</p>
        <button type="button" className="mt-4 rounded-control bg-accent px-4 py-1.5 text-sm font-medium text-white" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </div>
    );
  }
}
