import { describe, expect, it, vi } from 'vitest';
import { RecordatorioDeTareasJob } from '../../../src/core/jobs/cron/recordatorio-de-tareas.job';

/**
 * Cuándo se manda cada recordatorio de tarea, y sobre todo cuándo no.
 *
 * La lógica de decidir vive aparte del envío a propósito: es donde están las dos reglas que
 * importan —no repetir y no avisar con doce horas de algo que nunca tuvo doce horas de margen— y
 * probarlas contra el reloj real haría la prueba lenta y caprichosa.
 */
const UNA_HORA = 3_600_000;
const AHORA = new Date('2026-08-28T10:00:00Z');

/** Acceso a la decisión, que es privada porque nadie fuera del trabajo debe tomarla. */
function decidir(tarea: Record<string, unknown>) {
  const job = new RecordatorioDeTareasJob(
    {} as never, {} as never, {} as never, {} as never, {} as never,
  );
  return (job as unknown as {
    avisoQueToca: (t: unknown, a: Date) => { clave: string; horas: number } | null;
  }).avisoQueToca(tarea, AHORA);
}

/** Una tarea que vence dentro de `faltan` horas y se creó con `margen` horas de antelación. */
function tarea(faltan: number, margen: number, reminderSent: string | null = null) {
  const dueAt = new Date(AHORA.getTime() + faltan * UNA_HORA);
  return { dueAt, createdAt: new Date(dueAt.getTime() - margen * UNA_HORA), reminderSent };
}

describe('qué recordatorio de tarea toca', () => {
  it('no avisa cuando todavía falta más de medio día', () => {
    expect(decidir(tarea(20, 48))).toBeNull();
  });

  it('manda el de doce horas cuando entra en esa ventana', () => {
    expect(decidir(tarea(11, 48))?.clave).toBe('12h');
  });

  it('manda el de tres horas cuando se acerca', () => {
    expect(decidir(tarea(2, 48, '12h'))?.clave).toBe('3h');
  });

  /*
   * A dos horas del vencimiento se han cruzado los dos umbrales. Gana el más cercano: anunciar
   * «te quedan doce horas» cuando quedan dos es mentir, y quien lo lea dejará de fiarse del resto.
   */
  it('a dos horas manda el de tres, no el de doce, aunque no se haya mandado ninguno', () => {
    expect(decidir(tarea(2, 48))?.clave).toBe('3h');
  });

  /*
   * La regla que pediste: avisar «tienes esto en doce horas» de algo agendado hace veinte minutos
   * no informa de nada, y ese ruido es lo que hace que se dejen de leer los que sí importan.
   */
  it('no manda el de doce horas si la tarea nació con menos margen que eso', () => {
    expect(decidir(tarea(11, 2))).toBeNull();
  });

  it('esa misma tarea sí recibe el de tres horas', () => {
    expect(decidir(tarea(2, 2))?.clave).toBe('3h');
  });

  it('una tarea creada con trece horas de margen sí recibe el de doce', () => {
    expect(decidir(tarea(11, 13))?.clave).toBe('12h');
  });

  /*
   * El trabajo corre cada media hora. Sin esto, el recordatorio de las doce horas llegaría
   * veinticuatro veces antes que el de las tres.
   */
  it('no repite el que ya se mandó', () => {
    expect(decidir(tarea(11, 48, '12h'))).toBeNull();
  });

  it('no retrocede al de doce horas después de haber mandado el de tres', () => {
    expect(decidir(tarea(5, 48, '3h'))).toBeNull();
  });

  /*
   * Una vencida no llega hasta acá: la consulta del trabajo solo trae lo que vence de ahora en
   * adelante. Si llegara, se le da el umbral más cercano, que es lo único coherente.
   */
  it('una tarea ya vencida cae en el umbral más cercano', () => {
    expect(decidir(tarea(-1, 48))?.clave).toBe('3h');
  });
});
