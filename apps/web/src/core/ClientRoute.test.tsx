import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { ClientRoute } from './ClientRoute';
import { useAuth, type User } from './auth';

const portal: User = {
  id: 'portal-capacidad',
  name: 'Portal capacidad',
  email: 'portal@example.invalid',
  role: 'client',
  clientId: 'empresa-1',
  capabilities: { crm: true, reservations: false },
};

function dibujar(capability: 'crm' | 'reservations') {
  act(() => useAuth.setState({ user: portal, token: 'token-prueba', loading: false }));
  return render(
    <MemoryRouter>
      <ClientRoute capability={capability}><div>Servicio visible</div></ClientRoute>
    </MemoryRouter>,
  );
}

describe('capacidad contratada en rutas del portal', () => {
  afterEach(() => act(() => useAuth.setState({ user: null, token: null, loading: false })));

  it('abre el servicio contratado', () => {
    dibujar('crm');
    expect(screen.getByText('Servicio visible')).toBeTruthy();
  });

  it('bloquea por URL directa el servicio no contratado', () => {
    dibujar('reservations');
    expect(screen.getByText('No tienes acceso a esta sección')).toBeTruthy();
    expect(screen.queryByText('Servicio visible')).toBeNull();
  });
});
