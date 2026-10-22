import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { QueVeUnaPersona } from './QueVeUnaPersona';

/*
 * La pantalla con la que se comprueba lo repartido.
 *
 * Lo que defiende esta prueba no es que pinte la lista, es que diga las tres cosas por las que
 * alguien la abre y que una lista a secas no contestaría:
 *
 *   - qué accesos no vienen del perfil, que son los que se revisan uno por uno;
 *   - que sin perfil no se ve nada menos, sino más, aunque la lista salga vacía;
 *   - que un acceso concedido aparte alcanza a la persona en todas las empresas que atiende.
 *
 * Las tres son fáciles de perder en una refactorización que «sólo ordena la vista», y perder
 * cualquiera deja una pantalla que tranquiliza sin informar, que es peor que no tenerla.
 */

const RESPUESTA = {
  userId: 'u1',
  nombre: 'Carla',
  correo: 'carla@local.cl',
  perfil: { id: 'p1', nombre: 'Anfitrión' },
  sinPerfil: false,
  asignadoPor: 'Pablo',
  areas: [
    { clave: 'reservations.turno', nombre: 'El turno del día', modulo: 'reservations', nivel: 'hacer', origen: 'perfil', motivo: null, porQuien: null, venceEl: null },
    { clave: 'reservations.cupones', nombre: 'Cupones', modulo: 'reservations', nivel: 'hacer', origen: 'concedido', motivo: 'cubre vacaciones', porQuien: 'Pablo', venceEl: '2026-11-30T00:00:00.000Z' },
  ],
  datosProtegidos: [
    { modulo: 'reservations', nombre: 'Reservas', nivel: 'bajo_registro', incluyeSensibles: true },
  ],
  avisoDeExtrasGlobales: true,
};

const get = vi.fn(async () => RESPUESTA);
vi.mock('../../core/api', () => ({ api: { get: (...args: unknown[]) => get(...(args as [])) } }));

function montar(datos: Partial<typeof RESPUESTA> = {}) {
  get.mockResolvedValueOnce({ ...RESPUESTA, ...datos } as typeof RESPUESTA);
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const envoltorio = ({ children }: { children: ReactNode }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  return render(
    <QueVeUnaPersona clientId="empresa-a" empresa="La Vitamina Centro" persona={{ id: 'u1', name: 'Carla' }} onCerrar={() => {}} />,
    { wrapper: envoltorio },
  );
}

describe('qué ve una persona', () => {
  it('dice el perfil y quién lo asignó', async () => {
    montar();
    await waitFor(() => expect(screen.getByText('Anfitrión')).toBeTruthy());
    expect(screen.getByText(/se lo asignó Pablo/)).toBeTruthy();
  });

  /*
   * El punto de la pantalla. Lo del perfil y lo concedido a mano se revisan de formas
   * distintas, así que la vista tiene que distinguirlos sin que haya que deducirlo.
   */
  it('separa lo que trae el perfil de lo concedido aparte, con su motivo y su vencimiento', async () => {
    montar();
    await waitFor(() => expect(screen.getByText('Cupones')).toBeTruthy());

    expect(screen.getByText('Del perfil')).toBeTruthy();
    expect(screen.getByText('Concedido aparte')).toBeTruthy();
    expect(screen.getByText(/Motivo: cubre vacaciones/)).toBeTruthy();
    expect(screen.getByText(/Lo hizo Pablo/)).toBeTruthy();
    expect(screen.getByText(/Vence el/)).toBeTruthy();
  });

  it('un acceso sin fecha de término lo dice, en vez de callarlo', async () => {
    montar({
      areas: [{ clave: 'crm.embudo', nombre: 'El embudo', modulo: 'crm', nivel: 'ver', origen: 'concedido', motivo: null, porQuien: 'Pablo', venceEl: null }],
    } as Partial<typeof RESPUESTA>);

    await waitFor(() => expect(screen.getByText(/Sin fecha de término/)).toBeTruthy());
  });

  /*
   * Sin perfil la lista sale vacía, y una lista vacía se lee como «no ve nada» cuando en
   * realidad manda el permiso del cargo, que es más ancho. Callarlo invierte el sentido.
   */
  it('sin perfil avisa que no se acota, en vez de dejar una lista vacía', async () => {
    montar({ perfil: null, sinPerfil: true, asignadoPor: null, areas: [] } as Partial<typeof RESPUESTA>);

    await waitFor(() => expect(screen.getByText(/Sin perfil no se acota por áreas/)).toBeTruthy());
  });

  it('avisa que lo concedido aparte alcanza a las demás empresas que atiende', async () => {
    montar();
    await waitFor(() => expect(screen.getByText(/alcanzan a esta persona en todas las empresas/)).toBeTruthy());
  });

  it('sin excepciones no muestra ese aviso', async () => {
    montar({ avisoDeExtrasGlobales: false } as Partial<typeof RESPUESTA>);

    await waitFor(() => expect(screen.getByText('Anfitrión')).toBeTruthy());
    expect(screen.queryByText(/en todas las empresas/)).toBeNull();
  });

  it('dice el nivel de datos protegidos y si incluye los de categoría especial', async () => {
    montar();
    await waitFor(() => expect(screen.getByText(/Los puede pedir, y queda constancia/)).toBeTruthy());
    expect(screen.getByText(/Incluye datos de categoría especial/)).toBeTruthy();
  });

  it('un módulo sin acceso a los datos no anuncia los sensibles', async () => {
    montar({
      datosProtegidos: [{ modulo: 'crm', nombre: 'CRM', nivel: 'oculto', incluyeSensibles: true }],
    } as Partial<typeof RESPUESTA>);

    await waitFor(() => expect(screen.getByText(/No los ve/)).toBeTruthy());
    expect(screen.queryByText(/Incluye datos de categoría especial/)).toBeNull();
  });
});
