import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import { FullPageSpinner } from '../components/ui/Spinner.jsx';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-1">
        Saltar al contenido
      </a>
      <Header onMenu={() => setMenuOpen(true)} />
      <div className="flex flex-1">
        <aside className="glass hidden w-60 shrink-0 border-r border-white/50 bg-white/35 lg:block">
          <div className="sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto overscroll-contain">
            <Sidebar />
          </div>
        </aside>
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <aside className="glass absolute inset-y-0 left-0 w-64 overflow-y-auto overscroll-contain bg-white/90 shadow-xl">
              <Sidebar onNavigate={() => setMenuOpen(false)} />
            </aside>
          </div>
        )}
        <main id="main" className="min-w-0 flex-1 px-4 py-5 lg:px-8 lg:py-7">
          <ErrorBoundary>
            <Suspense fallback={<FullPageSpinner />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
