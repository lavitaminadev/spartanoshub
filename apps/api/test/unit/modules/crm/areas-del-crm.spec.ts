import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { AREAS, PERFILES_SUGERIDOS } from '@espartanos/shared';
import { NivelDeAreaService } from '../../../../src/core/client-scope/nivel-de-area.service';
import { REQUIERE_AREA_KEY, type AreaExigida } from '../../../../src/core/authorization/requiere-area.decorator';
import { LeadController } from '../../../../src/modules/crm/leads/lead.controller';
import { ReglasController } from '../../../../src/modules/crm/reglas/reglas.controller';
import { ContactsController } from '../../../../src/modules/crm/contacts/contacts.controller';
import { LeadIngestController } from '../../../../src/modules/crm/leads/lead-ingest.controller';
import { PublicAgencyLeadsController } from '../../../../src/modules/crm/leads/public-agency-leads.controller';

/**
 * Qué área exige cada ruta del CRM, y qué alcanza un perfil real contra ella.
 *
 * Defiende lo que no puede fallar: que aplicar reglas —que reescribe semáforo, etapa y
 * responsable— no esté al alcance de quien sólo registra contactos, que convertir en cliente
 * sea de quien lo tiene concedido, y que la entrada pública no pida perfil.
 */
function exigida(clase: { prototype: object }, metodo: string): AreaExigida | undefined {
  return Reflect.getMetadata(REQUIERE_AREA_KEY, (clase.prototype as Record<string, object>)[metodo]);
}

function servicioCon(nombrePerfil: string) {
  const perfil = PERFILES_SUGERIDOS.find((p) => p.modulo === 'crm' && p.nombre === nombrePerfil)!;
  return new NivelDeAreaService(
    { findOne: vi.fn().mockResolvedValue({ perfilId: 'p1' }) } as never,
    { findOne: vi.fn().mockResolvedValue({ id: 'p1', areas: perfil.areas }) } as never,
    { find: vi.fn().mockResolvedValue([]) } as never,
  );
}

const alcanza = (nombrePerfil: string, exigencia: AreaExigida) =>
  servicioCon(nombrePerfil).alcanzaArea('org', 'u1', 'empresa-a', exigencia.clave, exigencia.nivel);

describe('áreas del CRM', () => {
  it('aplicar reglas exige reglas en «hacer», y leerlas sólo «ver»', () => {
    expect(exigida(ReglasController, 'aplicar')).toEqual({ clave: 'crm.reglas', nivel: 'hacer' });
    expect(exigida(ReglasController, 'listar')).toEqual({ clave: 'crm.reglas', nivel: 'ver' });
  });

  it('el asistente comercial no alcanza reglas en «hacer»', async () => {
    await expect(alcanza('Asistente comercial', exigida(ReglasController, 'aplicar')!)).resolves.toBe(false);
  });

  it('el asistente comercial sí registra contactos', async () => {
    const exigencia = exigida(ContactsController, 'update')!;
    expect(exigencia.clave).toBe('crm.contactos');
    await expect(alcanza('Asistente comercial', exigencia)).resolves.toBe(true);
  });

  it('convertir en cliente queda fuera de quien no lo incluye y dentro del jefe comercial', async () => {
    const exigencia = exigida(LeadController, 'convert')!;
    expect(exigencia).toEqual({ clave: 'crm.convertir', nivel: 'hacer' });
    await expect(alcanza('Asistente comercial', exigencia)).resolves.toBe(false);
    await expect(alcanza('Ejecutivo', exigencia)).resolves.toBe(false);
    await expect(alcanza('Jefe comercial', exigencia)).resolves.toBe(true);
  });

  it('las rutas de entrada pública no piden perfil: se autentican con el token del origen', () => {
    expect(exigida(LeadIngestController, 'recibir')).toBeUndefined();
    expect(exigida(PublicAgencyLeadsController, 'submit')).toBeUndefined();
  });

  it('toda área declarada en los controladores existe en el catálogo', () => {
    const claves = new Set(AREAS.map((a) => a.clave));
    for (const clase of [LeadController, ReglasController, ContactsController]) {
      for (const metodo of Object.getOwnPropertyNames(clase.prototype)) {
        const e = exigida(clase, metodo);
        if (e) expect(claves.has(e.clave), `${clase.name}.${metodo}`).toBe(true);
      }
    }
  });
});
