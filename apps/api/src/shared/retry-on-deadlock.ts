import { Logger } from '@nestjs/common';

const logger = new Logger('RetryOnDeadlock');

/** Códigos de MySQL para interbloqueo y para espera de bloqueo agotada. */
const RETRYABLE_ERRNOS = new Set([1213, 1205]);

const DEFAULT_ATTEMPTS = 3;

function isRetryable(error: unknown): boolean {
  const errno = (error as { errno?: number })?.errno;
  return typeof errno === 'number' && RETRYABLE_ERRNOS.has(errno);
}

/** Espera creciente con un componente aleatorio, para que dos transacciones no reintenten a la vez. */
function backoffMs(attempt: number): number {
  return 25 * 2 ** (attempt - 1) + Math.floor(Math.random() * 25);
}

/**
 * Ejecuta una transacción reintentándola si MySQL la aborta por interbloqueo.
 *
 * Un interbloqueo no es un error de la petición: es el motor eligiendo a una de dos
 * transacciones que se cruzaron para poder continuar con la otra. La abortada puede
 * reintentarse y normalmente pasa a la segunda.
 *
 * Es necesario donde el orden en que se toman los bloqueos no es el mismo en todos los
 * caminos. Crear una reserva bloquea siempre primero la fila del formulario y después el
 * rango de horarios, así que dos creaciones se serializan y no pueden enclavarse. Reagendar
 * lo hace al revés —primero la reserva, después el rango—, de modo que dos reagendamientos
 * que se crucen sí forman un ciclo. Sin reintento, eso es un error 500 para el operador.
 *
 * La función debe ser segura de repetir: se reintenta la transacción completa, así que todo
 * lo que hace se deshace al abortar. No envolver acá nada que escriba fuera de la base.
 *
 * @param operation - Descripción corta para el registro cuando haya que reintentar.
 * @param work - La transacción a ejecutar.
 * @param attempts - Intentos totales, incluido el primero.
 */
export async function retryOnDeadlock<T>(
  operation: string,
  work: () => Promise<T>,
  attempts = DEFAULT_ATTEMPTS,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (!isRetryable(error) || attempt >= attempts) throw error;
      const wait = backoffMs(attempt);
      logger.warn(`${operation}: interbloqueo en el intento ${attempt} de ${attempts}, reintentando en ${wait} ms`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}
