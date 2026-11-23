import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import CompleteOccurrenceModal from '../features/occurrences/components/CompleteOccurrenceModal.jsx';
import ProgramMatrix from '../features/program/components/ProgramMatrix.jsx';
import { occurrence, program, viewerUser } from './fixtures.js';
import { renderApp } from './renderApp.jsx';

describe('ProgramMatrix', () => {
  it('renders statuses with text labels, overdue/rescheduled marks and N/A for months not yet due', () => {
    render(
      <MemoryRouter>
        <ProgramMatrix data={program} />
      </MemoryRouter>,
    );
    expect(screen.getByText('feb-26')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Realizada fuera de tiempo/ })).toBeInTheDocument();
    const overdue = screen.getByRole('link', { name: /Vencida.*reprogramada/ });
    expect(overdue.className).toContain('ring-red-600');
    const pctRow = screen.getByText(/% Cumplimiento/).closest('tr');
    expect(within(pctRow).getAllByText('N/A').length).toBeGreaterThanOrEqual(10);
    // Feb (done late → 0% on time) and Sep (due, not done) are exigible; the rest are N/A.
    expect(within(pctRow).getAllByText('0%')).toHaveLength(2);
  });
});

describe('CompleteOccurrenceModal', () => {
  const renderModal = (occ) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CompleteOccurrenceModal open onClose={() => {}} occ={occ} />
      </QueryClientProvider>,
    );

  it('blocks submission without evidence when it is required', () => {
    renderModal(occurrence());
    expect(screen.getByText(/requiere evidencia/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar a validación' })).toBeDisabled();
  });

  it('allows submission once evidence exists', () => {
    renderModal(occurrence({ evidence: [{ _id: 'e1', originalName: 'a.pdf' }] }));
    expect(screen.getByRole('button', { name: 'Enviar a validación' })).toBeEnabled();
  });
});

describe('routing', () => {
  it('RequireRole sends a VIEWER to /403 on admin pages', async () => {
    renderApp('/admin/users', { me: viewerUser });
    expect(await screen.findByText('Sin permiso')).toBeInTheDocument();
  });

  it('redirects to /login when there is no session', async () => {
    renderApp('/occurrences/abc', { signedIn: false });
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByText('Inicia sesión para continuar.')).toBeInTheDocument();
  });

  it('hides admin menu entries from a VIEWER', async () => {
    renderApp('/', { me: viewerUser });
    await screen.findByText(/Hola, Victor/);
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Programa anual' }).length).toBeGreaterThan(0);
  });
});

// Smoke test: every page renders with realistic API data and no runtime errors.
const PAGES = [
  ['/', /Hola, Ana/],
  ['/my-audits', 'Mis auditorías'],
  ['/program?year=2026', 'Programa General de Auditorías 2026'],
  ['/occurrences/000000000000000000000100', /#9 · Special Process/],
  ['/audits', 'Catálogo de auditorías'],
  ['/audits/000000000000000000000010', /#9 · Special Process/],
  ['/audits/new', 'Nueva auditoría'],
  ['/audits/000000000000000000000010/edit', /Editar #9/],
  ['/validations', 'Validaciones'],
  ['/profile', 'Mi perfil'],
  ['/admin/users', 'Usuarios'],
  ['/admin/groups', 'Grupos responsables'],
  ['/admin/groups/000000000000000000000050', 'Equipo Soldadura'],
  ['/admin/calendar', 'Días no laborables'],
  ['/admin/import', 'Importar programa desde Excel'],
  ['/admin/changelog', 'Bitácora de cambios'],
  ['/no-existe', 'Página no encontrada'],
];

describe('pages render', () => {
  it.each(PAGES)('%s', async (path, heading) => {
    renderApp(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it.each([
    ['/login', 'Iniciar sesión'],
    ['/register', 'Crear cuenta'],
    ['/forgot-password', 'Recuperar contraseña'],
    ['/reset-password', 'Nueva contraseña'],
  ])('%s (public)', async (path, heading) => {
    renderApp(path, { signedIn: false });
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
});
