import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth.api.js';
import { setUnauthorizedHandler, tokenStore } from '../api/client.js';
import { qk } from '../constants/queryKeys.js';
import { AuthContext } from './useAuth.js';

export default function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => tokenStore.get());

  const meQuery = useQuery({
    queryKey: qk.me,
    queryFn: authApi.me,
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const signOut = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  const signIn = useCallback(
    (newToken) => {
      tokenStore.set(newToken);
      queryClient.clear();
      setToken(newToken);
    },
    [queryClient],
  );

  // Any 401 from the API (expired/revoked session) signs the user out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      queryClient.clear();
    });
  }, [queryClient]);

  const value = useMemo(() => {
    const user = token ? meQuery.data ?? null : null;
    return {
      user,
      isLoading: Boolean(token) && meQuery.isLoading,
      isAuthenticated: Boolean(user),
      hasRole: (...roles) => Boolean(user?.roles?.some((r) => roles.includes(r))),
      signIn,
      signOut,
      refresh: () => meQuery.refetch(),
    };
  }, [token, meQuery, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
