import { describe, expect, it, vi } from 'vitest';
import { AccountAccessService } from '../../../src/core/client-scope/account-access.service';
import { AccionesService } from '../../../src/core/authorization/acciones.service';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

/*
 * Lo prestado caduca solo.
 *
 * Quien cubre dos semanas de vacaciones no debe quedarse con la cuenta para siempre porque nadie se
 * acuerde de quitársela. Los repositorios de estos casos evalúan de verdad la condición de
 * `where` —nulo, mayor que, dentro de—: un doble que ignora el filtro daría por buena cualquier consulta.
 */
type Operador = { type?: string; _type?: string; value?: unknown; _value?: unknown };

function cumple(fila: Record<string, unknown>, donde: Record<string, unknown>): boolean {
  return Object.entries(donde).every(([campo, esperado]) => {
    const actual = fila[campo];
    const operador = esperado as Operador;
    const tipo = operador?._type ?? operador?.type;
    if (!tipo) return actual === esperado;
    const valor = operador._value ?? operador.value;
    if (tipo === 'isNull') return actual == null;
    if (tipo === 'moreThan') return actual != null && (actual as Date) > (valor as Date);
    if (tipo === 'in') return (valor as unknown[]).includes(actual);
    throw new Error(`Operador no previsto en la prueba: ${tipo}`);
  });
}

function repoDe(filas: Array<Record<string, unknown>>) {
  return {
    find: vi.fn(async ({ where }: { where: Record<string, unknown> | Array<Record<string, unknown>> }) => {
      const alternativas = Array.isArray(where) ? where : [where];
      return filas.filter((fila) => alternativas.some((alternativa) => cumple(fila, alternativa)));
    }),
  };
}

const DIA = 86_400_000;
const persona = { id: 'u-1', email: 'a@b.cl', name: 'Ana', role: UserRole.COMMUNITY_MANAGER, organizationId: 'org-1', tenantId: 'org-1' } as never;

function servicioConCesiones(cesiones: Array<Record<string, unknown>>) {
  const base = { organizationId: 'org-1', userId: 'u-1', retiredAt: null };
  return new AccountAccessService(
    { find: vi.fn().mockResolvedValue([]), findOne: vi.fn() } as never,
    { find: vi.fn().mockResolvedValue([]) } as never,
    repoDe(cesiones.map((cesion) => ({ ...base, ...cesion }))) as never,
  );
}

describe('cesión de una cuenta con fecha de término', () => {
  it('una cesión vencida no aparece en allowedClientIds', async () => {
    const servicio = servicioConCesiones([
      { clientId: 'vencida', expiresAt: new Date(Date.now() - DIA) },
      { clientId: 'vigente', expiresAt: new Date(Date.now() + 7 * DIA) },
    ]);

    await expect(servicio.allowedClientIds('org-1', persona)).resolves.toEqual(['vigente']);
  });

  it('prestar sin fecha sigue valiendo: sin término no es vencida', async () => {
    const servicio = servicioConCesiones([{ clientId: 'sin-fecha', expiresAt: null }]);

    await expect(servicio.allowedClientIds('org-1', persona)).resolves.toEqual(['sin-fecha']);
  });

  it('una retirada no cuenta aunque no haya vencido', async () => {
    const servicio = servicioConCesiones([{ clientId: 'retirada', expiresAt: null, retiredAt: new Date() }]);

    await expect(servicio.allowedClientIds('org-1', persona)).resolves.toEqual([]);
  });

  it('explain y empresasDe tampoco cuentan la vencida', async () => {
    const servicio = servicioConCesiones([
      { clientId: 'vencida', expiresAt: new Date(Date.now() - 1000) },
      { clientId: 'vigente', expiresAt: new Date(Date.now() + DIA) },
    ]);

    expect(await servicio.explain('org-1', persona)).toEqual([{ clientId: 'vigente', source: 'assignment' }]);
    const mapa = await servicio.empresasDe('org-1', [{ id: 'u-1', role: UserRole.COMMUNITY_MANAGER }]);
    expect(mapa.get('u-1')).toEqual(['vigente']);
  });
});

describe('ajuste de acción con fecha de término', () => {
  it('uno vencido ya no rige: la acción vuelve al nivel de su módulo', async () => {
    const permisos = { permissionsFor: vi.fn().mockResolvedValue({ crm: 'none' }) };
    const ajustes = {
      find: vi.fn().mockResolvedValue([
        { action: 'crm.importar', allowed: true, expiresAt: new Date(Date.now() - DIA) },
      ]),
    };
    const servicio = new AccionesService(ajustes as never, permisos as never);

    const importar = (await servicio.explicar('org-1', 'u-1', UserRole.COMMUNITY_MANAGER)).find((accion) => accion.clave === 'crm.importar');

    expect(importar?.origen).toBe('nivel');
  });

  it('uno vigente sigue rigiendo', async () => {
    const permisos = { permissionsFor: vi.fn().mockResolvedValue({ crm: 'edit' }) };
    const ajustes = {
      find: vi.fn().mockResolvedValue([
        { action: 'crm.importar', allowed: false, expiresAt: new Date(Date.now() + DIA) },
      ]),
    };
    const servicio = new AccionesService(ajustes as never, permisos as never);

    const importar = (await servicio.explicar('org-1', 'u-1', UserRole.COMMUNITY_MANAGER)).find((accion) => accion.clave === 'crm.importar');

    expect(importar).toMatchObject({ origen: 'ajuste', permitida: false });
  });
});
