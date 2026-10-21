/**
 * Dónde se decide sobre qué empresa va una petición.
 *
 * No hay un punto único: la misma frase —«la empresa pedida si la cuenta la alcanza, si no la
 * mía»— está reescrita en varios controladores, cada uno a su manera. Con una sola empresa por
 * cuenta el repliegue siempre acertaba, y por eso ninguna prueba falló nunca; con dos, una ruta
 * que resuelve mal escribe en la empresa equivocada y responde 200.
 *
 * Esta prueba no arregla eso. Lo que hace es impedir que crezca: cuenta los archivos que leen la
 * empresa desde la cuenta y falla si aparece uno que no esté en la lista. Un controlador nuevo que
 * vuelva a escribir la frase a mano no pasa, y el arreglo —que `@Empresa()` llegue comprobada y
 * una ruta sin declarar responda 403— se puede hacer por partes sin que el resto se degrade por
 * detrás. A medida que cada archivo se migre, se saca de aquí; cuando la lista quede en las tres
 * piezas que de verdad resuelven la identidad, el trabajo está hecho.
 *
 * Mide el texto del código a propósito. Una prueba de comportamiento aquí tendría que levantar
 * cada controlador con dos empresas, y ninguna de esas pruebas se habría escrito para el
 * controlador que todavía no existe, que es justo el que importa.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RAIZ = join(__dirname, '..', '..', '..', 'src');

/**
 * Leer `user.clientId` sólo es legítimo donde se resuelve la identidad o el alcance mismo.
 *
 * `auth.service`, `jwt.strategy` y `auth.controller` arman la sesión: la empresa de la cuenta es
 * un dato de la credencial. `account-access.service` convierte eso en alcance, y
 * `empresa-resuelta` es el único sitio donde se decide la empresa de una petición —a donde debe
 * ir todo lo demás—. `permission.guard` y `requiere-accion` la leen para sus propias rejas.
 */
const RESUELVEN_LA_IDENTIDAD = [
  'core/auth/auth.service.ts',
  'core/auth/auth.controller.ts',
  'core/auth/jwt.strategy.ts',
  'core/client-scope/account-access.service.ts',
  'core/client-scope/empresa-resuelta.ts',
  /*
   * El único sitio donde se decide de qué empresa son los datos legales, que Reservas y Encuestas
   * resolvían cada una por su cuenta. Aplica la misma tabla y lee la empresa de la cuenta sólo
   * como el caso «no la declara y alcanza una sola».
   */
  'modules/clients/datos-legales-de-empresa.ts',
  'core/authorization/permission.guard.ts',
  'core/authorization/requiere-accion.ts',
];

/**
 * Los que la leen por otra razón, no para decidir sobre qué empresa va la petición.
 *
 * Son los que el triaje de la migración separó, y la diferencia importa: reescribirlos «por
 * uniformidad» cambiaría lo que hacen. Cada uno dice aquí por qué está.
 */
const LA_LEEN_POR_OTRA_RAZON = [
  /*
   * Compara con la propia («¿es su empresa?») y reconstruye la cuenta de **otra** persona para
   * preguntar qué alcanza ella: ahí `clientId` es un dato de esa cuenta, no de esta petición.
   */
  'core/authorization/permissions.controller.ts',
  /* Compara con la propia antes de responder 404. */
  'modules/meetings/meetings.controller.ts',
  /*
   * **Asigna** a qué empresa pertenece una cuenta. Es el dato que todo lo demás lee, no un
   * repliegue: aquí es donde se escribe.
   */
  'modules/users/update-user.use-case.ts',
  /*
   * Honran la empresa declarada y sólo usan la de la cuenta cuando no se declaró ninguna, que es
   * la regla del contrato —«no la declara y alcanza una sola → esa»—, con `assertClient` delante.
   */
  'modules/client-portal/portal-home.controller.ts',
  'core/notifications/destinatarios-de-avisos.controller.ts',
  'modules/reservations/reservations.controller.ts',
  'modules/users/administracion-del-equipo.service.ts',
];

/**
 * Los que todavía la deciden por su cuenta, y que `@Empresa()` va a reemplazar.
 *
 * Esta lista sólo puede encogerse. Cada nombre que sale de aquí es una ruta que pasó a recibir la
 * empresa ya comprobada; ninguno debería volver a entrar. Vacía significa que la migración
 * terminó, y entonces lo que queda vigilando es el primer caso: que no aparezca uno nuevo.
 */
const PENDIENTES_DE_MIGRAR: string[] = [];

const PERMITIDOS = new Set([...RESUELVEN_LA_IDENTIDAD, ...LA_LEEN_POR_OTRA_RAZON, ...PENDIENTES_DE_MIGRAR]);

function archivosTs(directorio: string, acumulado: string[] = []): string[] {
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) archivosTs(ruta, acumulado);
    else if (entrada.name.endsWith('.ts') && !entrada.name.endsWith('.spec.ts')) acumulado.push(ruta);
  }
  return acumulado;
}

/** Los archivos que leen la empresa desde la cuenta, con la ruta tal como se escribe en las listas. */
function losQueLeenLaEmpresaDeLaCuenta(): string[] {
  return archivosTs(RAIZ)
    .filter((ruta) => /\buser[!?]?\.clientId\b/.test(readFileSync(ruta, 'utf8')))
    .map((ruta) => relative(RAIZ, ruta).split(sep).join('/'))
    .sort();
}

describe('dónde se decide la empresa de la petición', () => {
  it('ningún archivo nuevo lee la empresa desde la cuenta', () => {
    const intrusos = losQueLeenLaEmpresaDeLaCuenta().filter((ruta) => !PERMITIDOS.has(ruta));

    expect(intrusos, [
      'Estos archivos deciden por su cuenta sobre qué empresa va la petición:',
      ...intrusos.map((ruta) => `  · ${ruta}`),
      '',
      'Recibe la empresa ya comprobada en vez de leerla de la cuenta. Volver a escribir «la pedida',
      'si la alcanza, si no la mía» es el defecto que esta prueba existe para frenar: con dos',
      'empresas, una resolución distinta a la del resto escribe en la equivocada y responde 200.',
    ].join('\n')).toEqual([]);
  });

  /*
   * El otro lado de la pinza. Sin esto, la lista de pendientes se queda con nombres de archivos
   * ya migrados o renombrados, y deja de decir cuánto falta: una lista que no se vacía no mide.
   */
  it('la lista de pendientes no nombra archivos que ya no la leen', () => {
    const leen = new Set(losQueLeenLaEmpresaDeLaCuenta());
    const sobrantes = [...PENDIENTES_DE_MIGRAR, ...LA_LEEN_POR_OTRA_RAZON, ...RESUELVEN_LA_IDENTIDAD]
      .filter((ruta) => !leen.has(ruta));

    expect(sobrantes, [
      'Estos archivos ya no leen la empresa desde la cuenta. Sácalos de la lista de este archivo:',
      ...sobrantes.map((ruta) => `  · ${ruta}`),
    ].join('\n')).toEqual([]);
  });
});
