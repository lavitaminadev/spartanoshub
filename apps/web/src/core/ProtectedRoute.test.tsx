import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth, type User } from './auth';

const portalNuevo: User = {
  id: 'portal-qa',
  name: 'Portal QA',
  email: 'portal@example.invalid',
  role: 'client',
  clientId: 'cliente-qa',
  mustChangePassword: true,
  mustCompleteProfile: true,
  mustAcceptTerms: true,
};

function dibujar(path: string, user: User) {
  act(() => useAuth.setState({ user, token: 'token-prueba', loading: false }));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Ingreso</div>} />
        <Route path="/first-access" element={
          <ProtectedRoute path="/first-access"><div>Primer acceso visible</div></ProtectedRoute>
        } />
        <Route path="/portal" element={
          <ProtectedRoute path="/portal"><div>Portal</div></ProtectedRoute>
        } />
      </Routes>
    </MemoryRouter>,
  );
}

describe('rutas personales de una cuenta cliente', () => {
  afterEach(() => act(() => useAuth.setState({ user: null, token: null, loading: false })));

  it('permite completar el primer acceso sin rebotar al portal', () => {
    dibujar('/first-access', portalNuevo);
    expect(screen.getByText('Primer acceso visible')).toBeTruthy();
    expect(screen.queryByText('Portal')).toBeNull();
  });

  it('envía al primer acceso cuando la cuenta nueva intenta abrir el portal', () => {
    dibujar('/portal', portalNuevo);
    expect(screen.getByText('Primer acceso visible')).toBeTruthy();
  });
});
