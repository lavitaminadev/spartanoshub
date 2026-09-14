import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompanyLegalDto, empresaDelPortal, guardarDatosLegales, leerDatosLegales } from '../../../src/modules/clients/datos-legales-de-empresa';

const FILA = { legal_name: 'Casa SpA', tax_id: '76.123.456-7', privacy_email: 'priv@casa.cl', privacy_url: 'https://casa.cl/p', terms_url: null, legal_mode: 'enlace', privacy_text: null, terms_text: null };

describe('datos legales de la empresa', () => {
  it('lee sólo dentro de la organización y avisa si la empresa no existe', async () => {
    const query = vi.fn().mockResolvedValueOnce([FILA]).mockResolvedValueOnce([]);
    const db = { query } as never;
    await expect(leerDatosLegales(db, 'org', 'c1')).resolves.toMatchObject({ legalName: 'Casa SpA', legalMode: 'enlace' });
    expect(query.mock.calls[0][1]).toEqual(['c1', 'org']);
    await expect(leerDatosLegales(db, 'org', 'otra')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('guarda vacíos como null, deja constancia en auditoría y devuelve lo guardado', async () => {
    const query = vi.fn().mockResolvedValueOnce([FILA]).mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ ...FILA, tax_id: null }]);
    const audit = { log: vi.fn().mockResolvedValue(undefined) };
    const resultado = await guardarDatosLegales({ query } as never, audit as never, 'org', 'c1', { legalName: ' Casa SpA ', taxId: '   ', legalMode: 'enlace' }, 'u1');
    const [sql, params] = query.mock.calls[1];
    expect(sql).toContain('WHERE id = ? AND organization_id = ?');
    expect(params.slice(0, 2)).toEqual(['Casa SpA', null]);
    expect(params.slice(-2)).toEqual(['c1', 'org']);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'ClientLegalData', entityId: 'c1', actorId: 'u1' }));
    expect(resultado.taxId).toBeNull();
  });

  it('rechaza enlaces que no son https y correos inválidos', async () => {
    const dto = plainToInstance(CompanyLegalDto, { privacyUrl: 'http://casa.cl/p', privacyEmail: 'no-es-correo' });
    const errores = await validate(dto);
    expect(errores.map((error) => error.property).sort()).toEqual(['privacyEmail', 'privacyUrl']);
  });

  it('no deja operar a una cuenta del portal sin empresa', () => {
    expect(() => empresaDelPortal(null)).toThrow(ForbiddenException);
    expect(empresaDelPortal('c1')).toBe('c1');
  });
});
