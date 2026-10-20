import { describe, expect, it, vi } from 'vitest';
import { NivelDeDatosService } from '../../../src/core/client-scope/nivel-de-datos.service';

/**
 * De dónde sale el nivel de datos protegidos de cada persona.
 *
 * Es el sitio donde el perfil se conecta con lo que el servidor entrega. Estas pruebas defienden
 * las tres cosas que pueden volver a separarse: que el perfil mande cuando existe, que vaya por
 * módulo, y que sin perfil nadie pierda lo que tenía el día del despliegue.
 */
function montar(opciones: {
  administra?: string[];
  asignaciones?: Array<{ clientId: string; perfilId: string }>;
  perfiles?: Array<{ id: string; datosProtegidos: Record<string, string> }>;
}) {
  const administradores = {
    empresasQueAdministra: vi.fn().mockResolvedValue(opciones.administra ?? []),
  };
  const asignaciones = {
    find: vi.fn().mockResolvedValue((opciones.asignaciones ?? []).map((fila) => ({ ...fila, userId: 'u1' }))),
  };
  const perfiles = { find: vi.fn().mockResolvedValue(opciones.perfiles ?? []) };
  return new NivelDeDatosService(administradores as never, asignaciones as never, perfiles as never);
}

describe('nivel de datos protegidos', () => {
  it('cuando hay perfil, manda el perfil y no quién administra', async () => {
    const servicio = montar({
      administra: ['empresa-a'],
      asignaciones: [{ clientId: 'empresa-a', perfilId: 'p1' }],
      perfiles: [{ id: 'p1', datosProtegidos: { reservations: 'oculto' } }],
    });

    const niveles = await servicio.nivelesDe('org-1', 'u1', 'reservations');

    // Administra la empresa, pero su perfil dice oculto: el perfil gana.
    expect(niveles.de('empresa-a')).toBe('oculto');
  });

  /*
   * Va por módulo porque no es lo mismo el teléfono de un prospecto, que comercial necesita para
   * llamarlo, que el documento de un comensal, que casi nadie necesita para atender.
   */
  it('el nivel es de cada módulo, no de la persona entera', async () => {
    const perfil = { id: 'p1', datosProtegidos: { crm: 'directo', reservations: 'oculto' } };
    const enCrm = montar({ asignaciones: [{ clientId: 'empresa-a', perfilId: 'p1' }], perfiles: [perfil] });
    const enReservas = montar({ asignaciones: [{ clientId: 'empresa-a', perfilId: 'p1' }], perfiles: [perfil] });

    expect((await enCrm.nivelesDe('org-1', 'u1', 'crm')).de('empresa-a')).toBe('directo');
    expect((await enReservas.nivelesDe('org-1', 'u1', 'reservations')).de('empresa-a')).toBe('oculto');
  });

  it('un módulo que el perfil no nombra queda oculto', async () => {
    const servicio = montar({
      asignaciones: [{ clientId: 'empresa-a', perfilId: 'p1' }],
      perfiles: [{ id: 'p1', datosProtegidos: { crm: 'directo' } }],
    });

    expect((await servicio.nivelesDe('org-1', 'u1', 'reservations')).de('empresa-a')).toBe('oculto');
  });

  /*
   * Sin perfil manda quien administra. Es el comportamiento anterior a los perfiles, y
   * conservarlo evita que el día del despliegue un local se quede sin poder atender porque nadie
   * había repartido perfiles todavía.
   */
  it('sin perfil asignado, quien administra ve directo y el resto bajo registro', async () => {
    const servicio = montar({ administra: ['empresa-a'] });
    const niveles = await servicio.nivelesDe('org-1', 'u1', 'reservations');

    expect(niveles.de('empresa-a')).toBe('directo');
    expect(niveles.de('empresa-b')).toBe('bajo_registro');
  });

  it('el perfil de una empresa no alcanza a la otra', async () => {
    const servicio = montar({
      administra: ['empresa-b'],
      asignaciones: [{ clientId: 'empresa-a', perfilId: 'p1' }],
      perfiles: [{ id: 'p1', datosProtegidos: { reservations: 'oculto' } }],
    });
    const niveles = await servicio.nivelesDe('org-1', 'u1', 'reservations');

    expect(niveles.de('empresa-a')).toBe('oculto');
    expect(niveles.de('empresa-b')).toBe('directo');
  });

  /* Una lista puede mezclar empresas: manda la más restrictiva, nunca la más abierta. */
  it('sobre varias empresas manda la más restrictiva', async () => {
    const servicio = montar({
      administra: ['empresa-b'],
      asignaciones: [{ clientId: 'empresa-a', perfilId: 'p1' }],
      perfiles: [{ id: 'p1', datosProtegidos: { reservations: 'oculto' } }],
    });
    const niveles = await servicio.nivelesDe('org-1', 'u1', 'reservations');

    expect(niveles.deTodas(['empresa-a', 'empresa-b'])).toBe('oculto');
    expect(niveles.deTodas(undefined)).toBe('bajo_registro');
  });

  it('sin empresa no se entrega nada directo', async () => {
    const servicio = montar({ administra: ['empresa-a'] });
    expect((await servicio.nivelesDe('org-1', 'u1', 'reservations')).de(null)).toBe('bajo_registro');
  });
});
