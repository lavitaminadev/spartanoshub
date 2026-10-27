import { describe, expect, it } from 'vitest';
import {
  MARCA_PROTEGIDA,
  columnasAQuitar,
  recortarListaProtegidos,
  recortarProtegidos,
  sePuedePedir,
} from '@espartanos/shared';

/**
 * Lo que decide qué datos personales salen del servidor.
 *
 * Estas pruebas defienden las dos cosas que pueden volver a romperlo: que `bajo_registro` recorte
 * igual que `oculto` —la diferencia es si se puede pedir, no si se entrega—, y que la exportación
 * quite las columnas en vez de llenarlas con la marca.
 */
describe('datos protegidos de una reserva', () => {
  const reserva = {
    id: 'r-1',
    guestName: 'Ana Pérez',
    guestPhone: '+56911111111',
    guestEmail: 'ana@example.com',
    guestDocument: '11.111.111-1',
    birthDate: '1990-04-21',
    answers: { alergia: 'maní' },
    partySize: 4,
    status: 'confirmed',
  };

  it('con nivel directo no toca nada', () => {
    const { datos, recortados, exigeConstancia } = recortarProtegidos(reserva, 'reservations', 'directo');
    expect(datos).toBe(reserva);
    expect(recortados).toEqual([]);
    expect(exigeConstancia).toBe(false);
  });

  it('con oculto recorta los protegidos y deja los operativos', () => {
    const { datos, recortados } = recortarProtegidos(reserva, 'reservations', 'oculto');

    expect(datos.guestPhone).toBe(MARCA_PROTEGIDA);
    expect(datos.guestDocument).toBe(MARCA_PROTEGIDA);
    expect(datos.birthDate).toBe(MARCA_PROTEGIDA);
    expect(datos.answers).toBe(MARCA_PROTEGIDA);
    // Sin esto no se puede atender a nadie.
    expect(datos.guestName).toBe('Ana Pérez');
    expect(datos.partySize).toBe(4);
    expect(datos.status).toBe('confirmed');
    expect(recortados).toContain('answers');
  });

  /*
   * La diferencia entre los dos niveles que recortan no es qué se entrega: es si existe la forma
   * de pedirlo. Entregar el dato y confiar en que la pantalla no lo pinte sería justo el error
   * que esta función evita.
   */
  it('bajo registro entrega lo mismo que oculto, y además dice que se puede pedir', () => {
    const conOculto = recortarProtegidos(reserva, 'reservations', 'oculto');
    const conRegistro = recortarProtegidos(reserva, 'reservations', 'bajo_registro');

    expect(conRegistro.datos).toEqual(conOculto.datos);
    expect(conRegistro.exigeConstancia).toBe(true);
    expect(conOculto.exigeConstancia).toBe(false);
    expect(sePuedePedir('bajo_registro')).toBe(true);
    expect(sePuedePedir('oculto')).toBe(false);
  });

  it('no muta el objeto que recibe', () => {
    recortarProtegidos(reserva, 'reservations', 'oculto');
    expect(reserva.guestPhone).toBe('+56911111111');
  });

  it('un campo vacío no se marca como protegido', () => {
    const sinTelefono = { ...reserva, guestPhone: null };
    const { datos, recortados } = recortarProtegidos(sinTelefono, 'reservations', 'oculto');
    expect(datos.guestPhone).toBeNull();
    expect(recortados).not.toContain('guestPhone');
  });

  it('sobre una lista recorta todas y reúne los campos tocados', () => {
    const { datos, recortados } = recortarListaProtegidos([reserva, reserva], 'reservations', 'oculto');
    expect(datos).toHaveLength(2);
    expect(datos[0].guestEmail).toBe(MARCA_PROTEGIDA);
    expect(recortados).toContain('guestEmail');
  });

  /*
   * El archivo sale sin las columnas, no con la marca dentro: un CSV con `__protegido__` en una
   * celda es un archivo que alguien va a intentar procesar.
   */
  it('la exportación quita las columnas en vez de marcarlas', () => {
    expect(columnasAQuitar('reservations', 'directo')).toEqual([]);
    const quitadas = columnasAQuitar('reservations', 'bajo_registro');
    expect(quitadas).toContain('guestPhone');
    expect(quitadas).toContain('answers');
    expect(quitadas).not.toContain('guestName');
  });

  it('cada módulo recorta lo suyo y no lo del vecino', () => {
    const prospecto = { id: 'l-1', name: 'Juan', phone: '+56922222222', guestPhone: 'no es de aquí' };
    const { datos } = recortarProtegidos(prospecto, 'crm', 'oculto');
    expect(datos.phone).toBe(MARCA_PROTEGIDA);
    expect(datos.guestPhone).toBe('no es de aquí');
    expect(datos.name).toBe('Juan');
  });
});
