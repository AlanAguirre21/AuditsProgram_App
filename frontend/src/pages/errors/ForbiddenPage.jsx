import { Link } from 'react-router-dom';

export default function ForbiddenPage() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <p className="text-5xl font-bold text-zf-blue">403</p>
      <h1 className="mt-2 text-lg font-semibold">Sin permiso</h1>
      <p className="mt-1 text-sm text-text-muted">Tu rol no tiene acceso a esta sección. Si lo necesitas, pide al administrador que te asigne el rol correspondiente.</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">Ir al inicio</Link>
    </div>
  );
}
