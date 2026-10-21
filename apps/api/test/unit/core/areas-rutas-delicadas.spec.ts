import { describe, expect, it, vi } from 'vitest';
import { AREAS } from '@espartanos/shared';
import { NivelDeAreaService } from '../../../src/core/client-scope/nivel-de-area.service';
import { REQUIERE_AREA_KEY, type AreaExigida } from '../../../src/core/authorization/requiere-area.decorator';
import { SurveysController } from '../../../src/modules/surveys/surveys.controller';
import { PublicSurveysController } from '../../../src/modules/surveys/public-surveys.controller';
import { CampanasController } from '../../../src/modules/marketing/campanas.controller';
import { SuscriptoresController } from '../../../src/modules/marketing/suscriptores.controller';
import { ProductionController } from '../../../src/modules/production/production.controller';
import { DesignBudgetController } from '../../../src/modules/design-budget/design-budget.controller';
import { BriefsController } from '../../../src/modules/briefs/briefs.controller';
import { ApprovalsController } from '../../../src/modules/approvals/approvals.controller';
import { PieceTypesController } from '../../../src/modules/production/piece-types.controller';
import { PerfilesController } from '../../../src/modules/users/perfiles/perfiles.controller';
import { InvitacionesPublicasController } from '../../../src/modules/users/perfiles/invitaciones-publicas.controller';
import { UsersController } from '../../../src/modules/users/users.controller';

/**
 * Las cuatro rutas que motivan las áreas: cada una está declarada con su área propia y un perfil
 * que sólo incluye las vecinas «ver» no la alcanza.
 */
function montar(perfil: Record<string, string>) {
  const asignaciones = { findOne: vi.fn().mockResolvedValue({ perfilId: 'p1' }) };
  const perfiles = { findOne: vi.fn().mockResolvedValue({ id: 'p1', areas: perfil }) };
  const extras = { find: vi.fn().mockResolvedValue([]) };
  return new NivelDeAreaService(asignaciones as never, perfiles as never, extras as never);
}

function exigida(controlador: { prototype: object }, metodo: string): AreaExigida | undefined {
  return Reflect.getMetadata(REQUIERE_AREA_KEY, (controlador.prototype as Record<string, object>)[metodo]);
}

const ORG = 'org-1';
const USUARIO = 'u1';
const EMPRESA = 'empresa-a';

describe('rutas delicadas: el área propia, nunca junto a «ver»', () => {
  const delicadas = [
    { nombre: 'enviar una campaña', controlador: CampanasController, metodo: 'enviar', clave: 'marketing.enviar', vecina: 'marketing.campanas' },
    { nombre: 'cancelar una pieza', controlador: ProductionController, metodo: 'cancel', clave: 'production.cancelar', vecina: 'production.piezas' },
    { nombre: 'ajustar lo contratado', controlador: DesignBudgetController, metodo: 'ajustarPresupuesto', clave: 'production.ajustar_presupuesto', vecina: 'production.presupuesto' },
    { nombre: 'enviar una encuesta por correo', controlador: SurveysController, metodo: 'sendEmail', clave: 'surveys.enviar', vecina: 'surveys.resultados' },
  ];

  for (const { nombre, controlador, metodo, clave, vecina } of delicadas) {
    it(`${nombre} exige ${clave} en «hacer»`, () => {
      expect(exigida(controlador, metodo)).toEqual({ clave, nivel: 'hacer' });
    });

    it(`un perfil con ${vecina} en «hacer» y sin ${clave} no alcanza ${nombre}`, async () => {
      const exigencia = exigida(controlador, metodo)!;
      const servicio = montar({ [vecina]: 'hacer' });
      await expect(servicio.alcanzaArea(ORG, USUARIO, EMPRESA, exigencia.clave, exigencia.nivel)).resolves.toBe(false);
    });
  }
});

describe('declaración de áreas en las rutas', () => {
  const controladores = [
    SurveysController, CampanasController, SuscriptoresController, ProductionController, PieceTypesController,
    DesignBudgetController, BriefsController, ApprovalsController, PerfilesController, UsersController,
  ];
  const catalogo = new Map(AREAS.map((area) => [area.clave, area]));

  it('toda área declarada existe en el catálogo y su nivel está entre los que admite', () => {
    for (const controlador of controladores) {
      for (const metodo of Object.getOwnPropertyNames(controlador.prototype)) {
        const exigencia = exigida(controlador, metodo);
        if (!exigencia) continue;
        const definicion = catalogo.get(exigencia.clave);
        expect(definicion, `${controlador.name}.${metodo}: ${exigencia.clave}`).toBeDefined();
        expect(definicion!.niveles, `${controlador.name}.${metodo}`).toContain(exigencia.nivel);
      }
    }
  });

  it('las rutas públicas no llevan área', () => {
    for (const controlador of [PublicSurveysController, InvitacionesPublicasController]) {
      for (const metodo of Object.getOwnPropertyNames(controlador.prototype)) {
        if (metodo === 'constructor') continue;
        expect(exigida(controlador, metodo), `${controlador.name}.${metodo}`).toBeUndefined();
      }
    }
    for (const metodo of ['confirmarBaja', 'baja']) {
      expect(exigida(SuscriptoresController, metodo), metodo).toBeUndefined();
    }
  });
});
