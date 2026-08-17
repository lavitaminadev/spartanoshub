/**
 * @fileoverview Main application shell.
 *
 * Wires the React Query client, global error boundary, and auth bootstrap.
 */

import { useEffect, useState, type JSX } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './core/auth';
import { AppRouter } from './core/router';
import { ErrorBoundary } from './core/ErrorBoundary';
import { persistQueryCache, restoreQueryCache } from './core/query-persistence';

/**
 * Restores the persisted session on mount and renders the router.
 */
function AuthBootstrap() {
  const checkAuth = useAuth((s) => s.checkAuth);
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  return <AppRouter />;
}

/**
 * Root application component.
 */
export default function App(): JSX.Element {
  // Create a fresh QueryClient per app instance so cache lifecycle aligns with mounts.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  }));

  // La copia local rellena la caché y luego queda escuchando sus cambios. Se restaura sin
  // bloquear el render: lo que llegue tarde igual aparece, porque `setQueryData` notifica a
  // los componentes ya montados.
  useEffect(() => {
    void restoreQueryCache(queryClient);
    return persistQueryCache(queryClient);
  }, [queryClient]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
