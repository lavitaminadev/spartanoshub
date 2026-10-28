import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';

/**
 * Cuándo se exige la aceptación de tratamiento de datos, y qué queda escrito cuando no se pide.
 *
 * Antes se exigía al guardar, así que un borrador a medio armar no se podía guardar sin la
 * casilla puesta. La obligación no se movió de sitio por comodidad: sigue entera sobre lo que
 * sale al público, que es donde hay un comensal entregando datos.
 *
 * La excepción existe para las páginas que no recogen datos de un comensal —internas, pruebas,
 * un evento cerrado— y obliga a escribir el motivo: una página sin casilla y sin motivo no se
 * distingue de un descuido, y esa diferencia es justamente la que hay que poder mostrar.
 */
const campos = [
  { id: 'name', type: 'text', label: 'Nombre', required: true },
  { id: 'consent', type: 'consent', label: 'Acepto', required: true },
];
const sinCasilla = [{ id: 'name', type: 'text', label: 'Nombre', required: true }];

function servicio(): ReservationsService {
  const vacio = {} as never;
  return new ReservationsService(
    vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio,
    vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio,
  );
}

/** Llama al guardia por su nombre: es privado y lo que se fija es la regla, no cómo se invoca. */
function comprobar(form: Record<string, unknown>) {
  return (servicio() as unknown as { assertConsentimientoDeclarado(f: unknown): void }).assertConsentimientoDeclarado(form);
}

/** Lo que se guardará en la reserva: fecha y texto del consentimiento. */
function evidencia(form: Record<string, unknown>, acepto: boolean) {
  return (servicio() as unknown as { evidenciaDeLaReserva(f: unknown, a: boolean): { reservationConsentAt: Date | null; reservationConsentText: string | null } })
    .evidenciaDeLaReserva(form, acepto);
}

describe('aceptación de tratamiento de datos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('una página con su casilla obligatoria pasa', () => {
    expect(() => comprobar({ fieldSchema: campos, consentimientoNoAplica: false })).not.toThrow();
  });

  it('sin casilla y sin excepción, no se publica', () => {
    expect(() => comprobar({ fieldSchema: sinCasilla, consentimientoNoAplica: false }))
      .toThrow('El formulario requiere una aceptación de tratamiento de datos');
  });

  it('una casilla opcional no cuenta: la aceptación es obligatoria o no es aceptación', () => {
    const opcional = [{ id: 'name', type: 'text', label: 'Nombre', required: true }, { id: 'consent', type: 'consent', label: 'Acepto', required: false }];
    expect(() => comprobar({ fieldSchema: opcional, consentimientoNoAplica: false }))
      .toThrow('El formulario requiere una aceptación de tratamiento de datos');
  });

  it('la excepción sin motivo escrito tampoco se publica', () => {
    expect(() => comprobar({ fieldSchema: sinCasilla, consentimientoNoAplica: true, motivoSinConsentimiento: '   ' }))
      .toThrow('Escribe por qué esta página no pide la aceptación');
  });

  it('la excepción con motivo pasa', () => {
    expect(() => comprobar({ fieldSchema: sinCasilla, consentimientoNoAplica: true, motivoSinConsentimiento: 'Página interna de pruebas' })).not.toThrow();
  });

  describe('lo que queda escrito en la reserva', () => {
    const texto = { designConfig: {}, fieldSchema: campos };

    it('bajo una página con excepción, el motivo y ninguna fecha de aceptación', () => {
      const resultado = evidencia({ ...texto, consentimientoNoAplica: true, motivoSinConsentimiento: 'Evento cerrado' }, true);
      expect(resultado.reservationConsentText).toBe('[no aplica] Evento cerrado');
      // Nadie aceptó nada: estampar una fecha haría pasar por consentimiento algo que no lo es.
      expect(resultado.reservationConsentAt).toBeNull();
    });

    it('quien no acepta no deja ni fecha ni texto', () => {
      expect(evidencia({ ...texto, consentimientoNoAplica: false }, false))
        .toEqual({ reservationConsentAt: null, reservationConsentText: null });
    });
  });
});
