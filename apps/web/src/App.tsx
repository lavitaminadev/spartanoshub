/**
 * @fileoverview Main application shell.
 *
 * Wires the React Query client, global error boundary, and auth bootstrap.
 */

import { useEffect, useRef, useState, type JSX } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { RolePreviewProvider } from './core/role-preview';
import { useAuth } from './core/auth';
import { AppRouter } from './core/router';
import { ErrorBoundary } from './core/ErrorBoundary';

/**
 * Restores the persisted session on mount and renders the router.
 */
function AuthBootstrap() {
  const checkAuth = useAuth((s) => s.checkAuth);
  const userId = useAuth((s) => s.user?.id);
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | undefined>(undefined);
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);
  useEffect(() => {
    if (previousUserId.current && previousUserId.current !== userId) void queryClient.clear();
    previousUserId.current = userId;
  }, [queryClient, userId]);
  return <AppRouter />;
}

/**
 * Root application component.
 */
export default function App(): JSX.Element {
  // Create a fresh QueryClient per app instance so cache lifecycle aligns with mounts.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RolePreviewProvider>
          <AuthBootstrap />
        </RolePreviewProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
