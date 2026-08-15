import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PieceTypesService } from '../../../src/modules/production/piece-types.service';
import { PieceTypeArea, PieceTypeStatus } from '../../../src/modules/production/piece-type-definition.entity';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

function crear(filas: any[] = [], config: Record<string, unknown> = {}) {
  const store = [...filas];
  const types = {
    find: vi.fn(async ({ where }: any) => store.filter((row) => {
      const estados = where.status?._value ?? where.status?.value ?? null;
      const okEstado = Array.isArray(estados) ? estados.includes(row.status) : !where.status || row.status === where.status;
      const claves = where.key?._value ?? where.key?.value ?? null;
      const okClave = Array.isArray(claves) ? claves.includes(row.key) : true;
      return okEstado && okClave && (!where.area || row.area === where.area);
    })),
    findOne: vi.fn(async ({ where }: any) => store.find((row) => (where.id ? row.id === where.id : row.key === where.key)) ?? null),
    create: (data: any) => data,
    save: vi.fn(async (row: any) => { store.push(row); return row; }),
  } as any;
  const parameters = { get: vi.fn(async (key: string) => config[key] ?? null) } as any;
  const audit = { log: vi.fn(async () => undefined) } as any;
  return { service: new PieceTypesService(types, parameters, audit), store, audit };
}

describe('PieceTypesService', () => {
  it('un tipo propuesto nace pendiente, no activo', async () => {
    const { service } = crear();
    const tipo = await service.propose('org-1', { label: 'Reel editado' } as any, 'user-1', UserRole.ART_DIRECTOR);

    expect(tipo.status).toBe(PieceTypeStatus.PENDING_APPROVAL);
    expect(tipo.key).toBe('reel_editado');
    expect(tipo.requestedBy).toBe('user-1');
  });

  it('deriva un identificador estable sin acentos ni espacios', async () => {
    const { service } = crear();
    const tipo = await service.propose('org-1', { label: 'Gigantografía de vía pública' } as any, 'u', UserRole.ADMIN);
    expect(tipo.key).toBe('gigantografia_de_via_publica');
  });

  it('no deja proponer un tipo de otra área', async () => {
    const { service } = crear();
    await expect(service.propose('org-1', { label: 'Video', area: PieceTypeArea.AUDIOVISUAL } as any, 'u', UserRole.DESIGNER))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rechaza un identificador que ya existe', async () => {
    const { service } = crear([{ id: 't1', key: 'logo', label: 'Logotipo', status: PieceTypeStatus.ACTIVE }]);
    await expect(service.propose('org-1', { label: 'Logo' } as any, 'u', UserRole.ADMIN))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('solo aprueba quien tiene la atribución configurada', async () => {
    const pendiente = { id: 't1', key: 'reel', label: 'Reel', status: PieceTypeStatus.PENDING_APPROVAL };

    const sinAtribucion = crear([{ ...pendiente }], { 'production.piece_type_approver_role': 'art_director' });
    await expect(sinAtribucion.service.approve('org-1', 't1', UserRole.DESIGNER, 'u'))
      .rejects.toBeInstanceOf(ForbiddenException);

    const conAtribucion = crear([{ ...pendiente }], { 'production.piece_type_approver_role': 'art_director' });
    const aprobado = await conAtribucion.service.approve('org-1', 't1', UserRole.ART_DIRECTOR, 'jefe-1');
    expect(aprobado.status).toBe(PieceTypeStatus.ACTIVE);
    expect(aprobado.approvedBy).toBe('jefe-1');
    expect(aprobado.approvedAt).toBeInstanceOf(Date);
  });

  it('administración aprueba siempre, aunque se configure otro cargo', async () => {
    const { service } = crear(
      [{ id: 't1', key: 'reel', label: 'Reel', status: PieceTypeStatus.PENDING_APPROVAL }],
      { 'production.piece_type_approver_role': 'av_director' },
    );
    expect((await service.approve('org-1', 't1', UserRole.ADMIN, 'admin-1')).status).toBe(PieceTypeStatus.ACTIVE);
  });

  it('quien aprueba puede fijar el valor distinto del propuesto', async () => {
    const { service } = crear([{ id: 't1', key: 'reel', label: 'Reel', udAmount: 2, status: PieceTypeStatus.PENDING_APPROVAL }]);
    const aprobado = await service.approve('org-1', 't1', UserRole.ADMIN, 'admin-1', { udAmount: 5 } as any);
    expect(Number(aprobado.udAmount)).toBe(5);
  });

  it('retirar no borra: el tipo queda para las piezas que ya lo usaron', async () => {
    const { service } = crear([{ id: 't1', key: 'paloma', label: 'Paloma', status: PieceTypeStatus.ACTIVE }]);
    const retirado = await service.retire('org-1', 't1', UserRole.ADMIN, 'Ya no se imprime');
    expect(retirado.status).toBe(PieceTypeStatus.RETIRED);
    expect(retirado.notes).toBe('Ya no se imprime');
  });

  it('un formulario solo ve los tipos activos; quien aprueba ve los pendientes', async () => {
    const filas = [
      { id: 't1', key: 'logo', label: 'Logo', area: PieceTypeArea.DESIGN, status: PieceTypeStatus.ACTIVE },
      { id: 't2', key: 'reel', label: 'Reel', area: PieceTypeArea.DESIGN, status: PieceTypeStatus.PENDING_APPROVAL },
    ];
    const equipo = crear(filas.map((f) => ({ ...f })));
    expect(await equipo.service.list('org-1', { role: UserRole.DESIGNER }, { includeInactive: true })).toHaveLength(1);

    const jefe = crear(filas.map((f) => ({ ...f })));
    expect(await jefe.service.list('org-1', { role: UserRole.ADMIN }, { includeInactive: true })).toHaveLength(2);
  });

  it('no deja pedir un tipo que aún no se aprueba', async () => {
    const { service } = crear([{ id: 't1', key: 'reel', label: 'Reel', status: PieceTypeStatus.PENDING_APPROVAL }]);
    await expect(service.assertUsable('org-1', ['reel'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta un tipo aprobado y también los del maestro sin sembrar', async () => {
    const { service } = crear([{ id: 't1', key: 'reel', label: 'Reel', status: PieceTypeStatus.ACTIVE }]);
    await expect(service.assertUsable('org-1', ['reel', 'post_simple'])).resolves.toBeUndefined();
  });
});
