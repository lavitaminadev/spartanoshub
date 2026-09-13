/**
 * Qué se garantiza: sólo una invitación firmada por el servidor, vigente y de esta misma encuesta
 * atribuye una respuesta a una reserva. Cualquier otra cosa se trata como respuesta anónima.
 */

import { describe, expect, it } from 'vitest';
import { crearInvitacion, leerInvitacion, VIGENCIA_INVITACION_SEGUNDOS } from '../../../src/modules/surveys/invitacion-a-encuesta';

const SECRETO = 'secreto-de-prueba-suficientemente-largo';
const AHORA = Date.UTC(2026, 8, 12, 12, 0, 0);

describe('invitación a encuesta', () => {
  it('se lee de vuelta con la encuesta y la reserva que la originaron', () => {
    const token = crearInvitacion('encuesta-1', 'reserva-9', SECRETO, AHORA);
    expect(leerInvitacion(token, 'encuesta-1', SECRETO, AHORA)).toEqual({
      surveyId: 'encuesta-1',
      reservationId: 'reserva-9',
      expira: Math.floor(AHORA / 1000) + VIGENCIA_INVITACION_SEGUNDOS,
    });
  });

  it('no lleva datos personales en el enlace', () => {
    const token = crearInvitacion('encuesta-1', 'reserva-9', SECRETO, AHORA);
    const cuerpo = Buffer.from(token.split('.')[0], 'base64url').toString('utf8');
    expect(Object.keys(JSON.parse(cuerpo)).sort()).toEqual(['r', 's', 'x']);
  });

  /* Cambiar la reserva en el enlace es la forma obvia de atribuirle respuestas a otra persona. */
  it('rechaza una invitación con el cuerpo alterado', () => {
    const token = crearInvitacion('encuesta-1', 'reserva-9', SECRETO, AHORA);
    const [, firma] = token.split('.');
    const otroCuerpo = Buffer.from(JSON.stringify({ s: 'encuesta-1', r: 'reserva-OTRA', x: 9999999999 })).toString('base64url');
    expect(leerInvitacion(`${otroCuerpo}.${firma}`, 'encuesta-1', SECRETO, AHORA)).toBeNull();
  });

  it('rechaza una invitación firmada con otro secreto', () => {
    const token = crearInvitacion('encuesta-1', 'reserva-9', 'otro-secreto', AHORA);
    expect(leerInvitacion(token, 'encuesta-1', SECRETO, AHORA)).toBeNull();
  });

  it('no sirve para otra encuesta', () => {
    const token = crearInvitacion('encuesta-1', 'reserva-9', SECRETO, AHORA);
    expect(leerInvitacion(token, 'encuesta-2', SECRETO, AHORA)).toBeNull();
  });

  it('vence al cumplirse su vigencia', () => {
    const token = crearInvitacion('encuesta-1', 'reserva-9', SECRETO, AHORA);
    const despues = AHORA + (VIGENCIA_INVITACION_SEGUNDOS + 1) * 1000;
    expect(leerInvitacion(token, 'encuesta-1', SECRETO, despues)).toBeNull();
  });

  it('devuelve null ante basura en vez de lanzar', () => {
    for (const basura of [undefined, '', 'sin-punto', 'a.b.c', '%%%.###', 'x'.repeat(700)]) {
      expect(leerInvitacion(basura, 'encuesta-1', SECRETO, AHORA)).toBeNull();
    }
  });

  it('no firma sin secreto', () => {
    expect(() => crearInvitacion('encuesta-1', 'reserva-9', '', AHORA)).toThrow();
  });
});
