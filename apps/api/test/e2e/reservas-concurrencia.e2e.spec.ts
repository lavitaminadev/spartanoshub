import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cerrarBanco, levantarBanco, type Banco } from './util/banco';

/**
 * El tope de reservas se respeta cuando llegan todas a la vez.
 *
 * Es el único escenario donde el sistema puede perder dinero y credibilidad en el mismo acto:
 * dos comensales sentados en la misma mesa a la misma hora, ambos con su confirmación. No se
 * detecta leyendo el código —cada petición, por separado, hace lo correcto— sino disparándolas
 * de verdad al mismo tiempo.
 *
 * Sin bloqueo, dos transacciones cuentan las reservas existentes antes de que la otra inserte,
 * ambas ven cupo y ambas insertan. Es la lectura fantasma clásica, y el único modo de provocarla
 * es la concurrencia real: un bucle secuencial pasa siempre, incluso con el bloqueo quitado.
 *
 * Existía como `scripts/smoke/reservas-simultaneas.cjs`, que había que acordarse de ejecutar a
 * mano contra una API levantada. Acá corre sola en cada cambio.
 *
 * **Esta prueba no debe hacerse pasar tocando el servicio.** Congela el comportamiento correcto
 * que ya existe: si falla, lo que se rompió es el bloqueo, no la prueba.
 */
describe('reservas simultáneas', () => {
  let banco: Banco;

  beforeAll(async () => {
    banco = await levantarBanco();
  }, 180_000);

  afterAll(async () => {
    if (banco) await cerrarBanco(banco);
  });

  /**
   * El día hábil número `n` a partir de mañana, contando solo de lunes a viernes.
   *
   * **Cuenta días hábiles, no días de calendario**, y esa es la corrección: antes sumaba `n` días
   * y luego empujaba el resultado al lunes si caía en fin de semana. Dos llamadas distintas
   * podían aterrizar en la misma fecha —un miércoles, `horarioHabil(3)` caía en sábado y saltaba
   * al lunes, justo el que devolvía `horarioHabil(5)`—, y como estas pruebas comparten cliente,
   * las reservas de una contaban contra el tope diario de la otra.
   *
   * El efecto era una suite que fallaba **solo los miércoles** y pasaba el resto de la semana,
   * que es la peor forma de fallar: parece que la rompió el último cambio.
   *
   * Ahora cada índice tiene su propio día hábil, así que dos llamadas con números distintos
   * nunca coinciden.
   *
   * @param habilesAdelante - Cuántos días hábiles avanzar. Debe ser al menos 1.
   */
  function horarioHabil(habilesAdelante: number): Date {
    const cuando = new Date();
    for (let restantes = habilesAdelante; restantes > 0; restantes -= 1) {
      do {
        cuando.setUTCDate(cuando.getUTCDate() + 1);
      } while ([0, 6].includes(cuando.getUTCDay()));
    }
    cuando.setUTCHours(17, 0, 0, 0); // 13:00 en Santiago, en medio de la ventana.
    return cuando;
  }

  /**
   * Crea y publica un formulario por la vía real de la aplicación.
   *
   * Sembrarlo por SQL obligaría a reproducir a mano la configuración de horarios que el servicio
   * da por hecha, y la prueba pasaría a depender de que esa copia siga al día.
   */
  async function formularioPublicado(
    clientId: string,
    nombre: string,
    topes: { capacityPerSlot: number; dailyCapacity: number },
  ): Promise<string> {
    const token = banco.cuentas.admin.token;
    const creado = await banco.pedir('POST', '/reservations/forms', token, {
      clientId, name: nombre, mode: 'appointment',
    });
    expect(creado.status, `crear formulario: ${JSON.stringify(creado.body)}`).toBe(201);

    const publicado = await banco.pedir('PATCH', `/reservations/forms/${creado.body.id}`, token, {
      ...topes, minimumNoticeHours: 0, status: 'published',
    });
    expect(publicado.status, `publicar: ${JSON.stringify(publicado.body)}`).toBe(200);
    expect(publicado.body.status).toBe('published');
    return publicado.body.publicSlug;
  }

  /** Dispara `cantidad` reservas a la vez sobre el mismo horario. */
  function enParalelo(slug: string, cuando: Date, cantidad: number, etiqueta: string) {
    return Array.from({ length: cantidad }, (_, i) => banco.pedir(
      'POST', `/public/reservations/${slug}`, undefined,
      {
        startsAt: cuando.toISOString(),
        guestName: `${etiqueta} ${i + 1}`,
        guestPhone: `+5691${String(i).padStart(7, '0')}`,
        partySize: 1,
        answers: { name: `${etiqueta} ${i + 1}`, phone: `+5691${String(i).padStart(7, '0')}`, consent: true },
        // Clave distinta en cada intento: acá se prueba la concurrencia, no la idempotencia.
        idempotencyKey: `${etiqueta}-${Date.now()}-${i}-aaaaaaaaaaaa`,
      },
    ));
  }

  async function reservasEnBase(where: string, params: unknown[]): Promise<number> {
    const [filas] = await banco.db.query(
      `SELECT COUNT(*) AS n FROM reservations WHERE ${where}`, params,
    ) as unknown as [{ n: number }[]];
    return Number(filas[0].n);
  }

  it('con cupo para tres y ocho intentos a la vez, quedan exactamente tres', async () => {
    const cliente = banco.empresas.reservasUno;
    const slug = await formularioPublicado(cliente, 'Concurrencia cupo', {
      capacityPerSlot: 3, dailyCapacity: 0,
    });
    const cuando = horarioHabil(3);

    const respuestas = await Promise.all(enParalelo(slug, cuando, 8, 'Comensal'));

    const creadas = respuestas.filter((r) => r.status === 201 || r.status === 200);
    const limitadas = respuestas.filter((r) => r.status === 429);

    // El cupo del limitador es por IP y formulario, y son diez por minuto: ocho intentos caben.
    // Si aparece un 429 la prueba no midió lo que dice medir, y decirlo es mejor que fallar por
    // el motivo equivocado.
    expect(limitadas.length, 'el limitador intervino; la prueba no concluye').toBe(0);
    expect(creadas.length).toBe(3);

    // Lo que importa es la base, no lo que respondió la API: una respuesta 201 sobre una
    // inserción que después se deshizo seguiría contando acá.
    const enBase = await reservasEnBase(
      'starts_at = ? AND status IN (?, ?, ?)',
      [cuando, 'pending', 'confirmed', 'rescheduled'],
    );
    expect(enBase).toBe(3);
  }, 120_000);

  it('el tope diario del cliente se respeta aunque las reservas entren por formularios distintos', async () => {
    /*
     * Este es el fallo histórico que documenta `lockClientDay`: el tope diario suma todos los
     * formularios de la cuenta, y bloquear solo la fila del formulario dejaba que dos de ellos
     * contaran cero a la vez y ambos insertaran. Por eso el bloqueo es `(cliente, día)`.
     */
    const cliente = banco.empresas.reservasUno;
    await banco.db.query('UPDATE clients SET daily_reservation_cap = 2 WHERE id = ?', [cliente]);

    const [slugA, slugB] = await Promise.all([
      formularioPublicado(cliente, 'Cruzado A', { capacityPerSlot: 10, dailyCapacity: 0 }),
      formularioPublicado(cliente, 'Cruzado B', { capacityPerSlot: 10, dailyCapacity: 0 }),
    ]);
    const cuando = horarioHabil(5);

    // Cada formulario tiene su propio cupo de limitador, así que cuatro y cuatro caben.
    const respuestas = await Promise.all([
      ...enParalelo(slugA, cuando, 4, 'CruceA'),
      ...enParalelo(slugB, cuando, 4, 'CruceB'),
    ]);

    expect(respuestas.filter((r) => r.status === 429).length, 'el limitador intervino').toBe(0);
    expect(respuestas.filter((r) => r.status === 201 || r.status === 200).length).toBe(2);

    const enBase = await reservasEnBase(
      'client_id = ? AND DATE(starts_at) = DATE(?) AND status IN (?, ?, ?)',
      [cliente, cuando, 'pending', 'confirmed', 'rescheduled'],
    );
    expect(enBase, 'el tope del cliente se excedió entre formularios').toBe(2);

    await banco.db.query('UPDATE clients SET daily_reservation_cap = 0 WHERE id = ?', [cliente]);
  }, 120_000);

  it('un día lleno no cierra el día siguiente', async () => {
    // El bloqueo es por `(cliente, día)`. Si su alcance se ampliara por error a toda la cuenta,
    // llenar un día dejaría la agenda entera sin cupo y nada más lo señalaría.
    const cliente = banco.empresas.reservasUno;
    const slug = await formularioPublicado(cliente, 'Aislamiento de dias', {
      capacityPerSlot: 1, dailyCapacity: 1,
    });

    const primerDia = horarioHabil(7);
    const llenado = await Promise.all(enParalelo(slug, primerDia, 3, 'Dia1'));
    expect(llenado.filter((r) => r.status === 201 || r.status === 200).length).toBe(1);

    const segundoDia = horarioHabil(8);
    // El día siguiente puede caer en el mismo si el 7 era viernes; se busca uno distinto.
    if (segundoDia.toDateString() !== primerDia.toDateString()) {
      const siguiente = await Promise.all(enParalelo(slug, segundoDia, 2, 'Dia2'));
      expect(siguiente.filter((r) => r.status === 201 || r.status === 200).length).toBe(1);
    }
  }, 120_000);
});
