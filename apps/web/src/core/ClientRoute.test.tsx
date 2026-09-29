import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
    <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>
      <ClientRoute capability={capability}><div>Servicio visible</div></ClientRoute>
    </MemoryRouter>
    </QueryClientProvider>,
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

describe('la empresa que se está mirando manda', () => {
  afterEach(() => act(() => useAuth.setState({ user: null, token: null, loading: false })));

  it('si la empresa activa no tiene el servicio, se bloquea aunque la propia lo tenga', () => {
    act(() => useAuth.setState({ user: portal, token: 'token-prueba', loading: false }));
    const consultas = new QueryClient();
    // La sesión dice CRM encendido; la lista del servidor dice que esta empresa lo tiene apagado.
    consultas.setQueryData(['clients'], { data: [{ id: 'empresa-1', name: 'Local', capabilities: { crm: false } }] });
    render(
      <QueryClientProvider client={consultas}>
        <MemoryRouter>
          <ClientRoute capability="crm"><div>Servicio visible</div></ClientRoute>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('No tienes acceso a esta sección')).toBeTruthy();
  });
});
