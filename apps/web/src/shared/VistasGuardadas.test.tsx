import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { VistasGuardadas } from './VistasGuardadas';

/*
 * Aplicar una vista guardada no puede romper la pantalla.
 *
 * Una vista trae sólo las claves que tenía puestas cuando se guardó, y quien la aplica recibe ese
 * objeto tal cual. Si la pantalla lo usa para **reemplazar** sus filtros, las claves que la vista
 * no trae desaparecen: en Reservas eso dejaba `filters.search` sin definir, al leer `.trim()`
 * reventaba y la pantalla entera se iba a «Esta vista encontró un problema».
 *
 * Una vista es un dato que viene de fuera —del equipo, de una versión anterior de la pantalla, de
 * lo que haya quedado en el navegador—, así que esto fija las dos mitades del contrato: lo que se
 * entrega es exactamente lo guardado, y quien lo recibe lo combina sobre sus valores vacíos.
 */
vi.mock('../core/api', () => ({
  api: {
    get: vi.fn(async () => ([
      // Una vista del equipo, guardada con un solo filtro puesto. El caso real.
      { id: 'v-1', name: 'Pendientes (del equipo)', filters: { status: 'pending' }, shared: true, propia: false },
    ])),
    post: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
  },
}));

function envoltorio({ children }: { children: ReactNode }) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

describe('vistas guardadas', () => {
  beforeEach(() => { window.localStorage.clear(); });

  it('entrega los filtros guardados tal cual, sin completar los que faltan', async () => {
    const aplicar = vi.fn();
    render(
      <VistasGuardadas ambito="reservas.lista" filtrosActuales={{ search: '', status: '' }} hayFiltros={false} onAplicar={aplicar} />,
      { wrapper: envoltorio },
    );

    fireEvent.click(await screen.findByText(/Pendientes/));

    expect(aplicar).toHaveBeenCalledWith({ status: 'pending' });
  });

  /*
   * El caso que tumbaba la pantalla, escrito como lo hace quien la aplica bien. Si alguien vuelve
   * a reemplazar el objeto entero en lugar de combinarlo, esta prueba lo deja a la vista.
   */
  it('combinada sobre los filtros vacíos, ninguna clave se pierde', async () => {
    const VACIOS = { search: '', status: '', formId: '', from: '', to: '', resourceId: '' };
    let resultado: typeof VACIOS | null = null;

    render(
      <VistasGuardadas
        ambito="reservas.lista"
        filtrosActuales={VACIOS}
        hayFiltros={false}
        onAplicar={(guardados) => { resultado = { ...VACIOS, ...guardados }; }}
      />,
      { wrapper: envoltorio },
    );

    fireEvent.click(await screen.findByText(/Pendientes/));

    await waitFor(() => expect(resultado).not.toBeNull());
    expect(resultado).toEqual({ ...VACIOS, status: 'pending' });
    // Lo que reventaba: leer una clave que la vista no traía.
    expect(() => resultado!.search.trim()).not.toThrow();
  });
});
