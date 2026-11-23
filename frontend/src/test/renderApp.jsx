import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api, tokenStore } from '../api/client.js';
import AuthProvider from '../auth/AuthProvider.jsx';
import AppRouter from '../routes/AppRouter.jsx';
import { adminUser, route } from './fixtures.js';

/** Routes every axios request to the fixtures (`me` can be overridden per test). */
export function mockApi({ me = adminUser } = {}) {
  api.defaults.adapter = async (config) => {
    const url = config.url;
    let data = url === '/auth/me' ? me : route(config.method, url);
    const body = data?.__page ? { data: data.__page, meta: { page: 1, limit: 50, total: data.__page.length, totalPages: 1 } } : { data };
    return { data: body, status: 200, statusText: 'OK', headers: {}, config };
  };
}

export function renderApp(path, { signedIn = true, me } = {}) {
  mockApi({ me });
  if (signedIn) tokenStore.set('test-token');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
