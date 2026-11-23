import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <p className="text-5xl font-bold text-zf-blue">404</p>
      <h1 className="mt-2 text-lg font-semibold">Página no encontrada</h1>
      <p className="mt-1 text-sm text-text-muted">La dirección no existe o fue movida.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">Ir al inicio</Link>
    </div>
  );
}
