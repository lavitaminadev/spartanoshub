import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CronController } from '../../../src/core/cron/cron.controller';

/**
 * Rotar la clave de las tareas programadas sin dejarlas caídas.
 *
 * Con una sola clave, cambiarla obligaba a tocar el servidor de tareas y el `.env` a la vez. Entre
 * un cambio y el otro las tareas dejaban de correr: la cobranza no se manda, las conversiones no
 * se entregan y los leads vencidos no se purgan. Y **nada avisa**, porque un cron que no corre no
 * da error: se descubre cuando alguien echa de menos un correo.
 *
 * Aceptando la anterior durante la transición, la rotación es en tres pasos y sin corte.
 */
function comprobar(controller: CronController, clave?: string): void {
  (controller as unknown as { verifySecret: (s?: string) => void }).verifySecret(clave);
}

describe('clave de las tareas programadas', () => {
  const nada = undefined as never;
  const controller = new CronController(nada, nada, nada, nada, nada, nada, nada, nada);
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.CRON_SECRET_PREVIOUS;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it('sin clave configurada no atiende a nadie, en vez de atender a todos', () => {
    expect(() => comprobar(controller, 'la-que-sea')).toThrow(ForbiddenException);
  });

  it('acepta la clave vigente', () => {
    process.env.CRON_SECRET = 'clave-nueva';
    expect(() => comprobar(controller, 'clave-nueva')).not.toThrow();
  });

  it('rechaza cualquier otra', () => {
    process.env.CRON_SECRET = 'clave-nueva';
    expect(() => comprobar(controller, 'clave-vieja')).toThrow(ForbiddenException);
    expect(() => comprobar(controller, '')).toThrow(ForbiddenException);
    expect(() => comprobar(controller, undefined)).toThrow(ForbiddenException);
  });

  it('durante la rotación acepta las dos: la nueva y la que aún tiene el disparador', () => {
    process.env.CRON_SECRET = 'clave-nueva';
    process.env.CRON_SECRET_PREVIOUS = 'clave-vieja';

    expect(() => comprobar(controller, 'clave-nueva')).not.toThrow();
    expect(() => comprobar(controller, 'clave-vieja')).not.toThrow();
  });

  it('al terminar la rotación, la anterior deja de servir', () => {
    process.env.CRON_SECRET = 'clave-nueva';
    // Tercer paso: se borra `CRON_SECRET_PREVIOUS`. Dejarla puesta desharía el sentido de rotar.
    expect(() => comprobar(controller, 'clave-vieja')).toThrow(ForbiddenException);
  });

  it('una clave de otro largo se rechaza sin comparar contenido', () => {
    process.env.CRON_SECRET = 'clave-nueva';
    // La comparación en tiempo constante exige el mismo largo; el rechazo por largo es lo que
    // impide que medir el tiempo revele en qué carácter falló.
    expect(() => comprobar(controller, 'x')).toThrow(ForbiddenException);
  });
});
