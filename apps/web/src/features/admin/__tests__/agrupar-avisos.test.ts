import { describe, expect, it } from 'vitest';
import { agruparAvisos } from '../PanelDeCorreo';

/** Las claves que el servidor entrega para un conjunto de avisos. */
const entrega = (...prefijos: string[]) => new Set(prefijos.map((prefijo) => `${prefijo}_enabled`));

const titulos = (modulos: ReturnType<typeof agruparAvisos>['modulosVisibles']) => modulos.map((modulo) => modulo.clave);

describe('agruparAvisos: qué grupos de correo ve cada empresa', () => {
  /*
   * Cobranza no depende de ningún servicio contratado, así que antes figuraba siempre en el
   * selector aunque el servidor no entregara ninguna plantilla suya: se elegía y la lista salía
   * vacía. Un grupo sin avisos no se ofrece.
   */
  it('no ofrece un grupo del que el servidor no entregó ningún aviso', () => {
    const { modulosVisibles } = agruparAvisos(entrega('email.reservation_confirmation'), { reservations: true, crm: true, surveys: true });

    expect(titulos(modulosVisibles)).toEqual(['reservas']);
  });

  it('oculta los grupos de un servicio que la empresa no contrató', () => {
    const todos = entrega('email.reservation_confirmation', 'email.post_visit_survey', 'email.new_lead', 'email.collection_overdue');

    const sinCrm = agruparAvisos(todos, { reservations: true, crm: false, surveys: true });
    expect(titulos(sinCrm.modulosVisibles)).toEqual(['reservas', 'encuestas', 'cobranza']);

    const sinEncuestas = agruparAvisos(todos, { reservations: true, crm: true, surveys: false });
    expect(titulos(sinEncuestas.modulosVisibles)).toEqual(['reservas', 'crm', 'cobranza']);
  });

  it('sin empresa elegida muestra todos los grupos: la plantilla general la heredan todas', () => {
    const { modulosVisibles } = agruparAvisos(entrega('email.reservation_confirmation', 'email.post_visit_survey', 'email.new_lead', 'email.collection_overdue'), undefined);

    expect(titulos(modulosVisibles)).toEqual(['reservas', 'encuestas', 'crm', 'cobranza']);
  });

  /*
   * El cumpleaños saluda a los contactos del CRM y a quien dejó su fecha al reservar. Agrupado
   * sólo bajo CRM desaparecía de la pantalla de una empresa sin CRM, mientras el correo sí salía.
   */
  it('el saludo de cumpleaños cae en Reservas cuando la empresa no tiene CRM', () => {
    const cumple = { modulo: 'crm', moduloAlterno: 'reservas' } as const;
    const entregado = entrega('email.reservation_confirmation', 'email.birthday');

    const conCrm = agruparAvisos(entregado, { reservations: true, crm: true, surveys: true });
    expect(conCrm.moduloDe(cumple)).toBe('crm');

    const sinCrm = agruparAvisos(entregado, { reservations: true, crm: false, surveys: true });
    expect(sinCrm.moduloDe(cumple)).toBe('reservas');
    expect(titulos(sinCrm.modulosVisibles)).toEqual(['reservas']);
  });

  it('un aviso cuyo grupo está oculto y no tiene alterno no se muestra', () => {
    const { moduloDe } = agruparAvisos(entrega('email.reservation_confirmation', 'email.new_lead'), { reservations: true, crm: false, surveys: true });

    expect(moduloDe({ modulo: 'crm' })).toBeNull();
  });
});
