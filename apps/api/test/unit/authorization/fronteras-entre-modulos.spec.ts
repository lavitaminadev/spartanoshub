/**
 * Qué módulo puede alcanzar a qué otro.
 *
 * Reservas y CRM son conceptos distintos: una reserva es un evento en un local, un lead es una
 * relación comercial. Cuando un módulo importa del otro, esa distinción deja de estar en el código
 * y pasa a estar sólo en la cabeza de quien lo escribió, que es donde se pierde.
 *
 * Lo que esta prueba hace no es cortar las dependencias que ya existen —cortarlas es trabajo, y
 * cortarlas sin motivo es riesgo sin ganancia—. Hace que **no crezcan**: la lista de abajo es el
 * estado de hoy, medido, y sólo puede encoger. Un módulo nuevo que importe de otro no pasa, y una
 * dependencia que se retire tiene que salir de la lista o la prueba lo dice.
 *
 * Es la misma técnica que `donde-se-decide-la-empresa.spec.ts`, que funcionó: encerrar un hallazgo
 * para que nadie lo redescubra y para que la deuda sea visible en vez de anecdótica.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MODULOS = join(__dirname, '..', '..', '..', 'src', 'modules');

/**
 * Los que todo el mundo puede alcanzar, porque son el suelo y no un módulo de producto.
 *
 * `clients` es la empresa atendida, `organizations` la organización y `users` las personas: no hay
 * módulo que funcione sin saber de quién es el dato y quién lo mira. Contarlos como dependencia
 * haría que la lista midiera ruido en vez de acoplamiento.
 */
const SUELO = ['clients', 'organizations', 'users'];

/**
 * Dependencias que existen hoy, medidas. **Esta lista sólo puede encoger.**
 *
 * Los ciclos están marcados: son los que más cuesta razonar, porque ninguno de los dos módulos se
 * entiende sin el otro, y los que primero conviene romper con un evento.
 */
const DEPENDENCIAS_DE_HOY: Record<string, string[]> = {
  approvals: ['crm', 'production'],
  automations: ['approvals', 'collaboration', 'contracts', 'crm'],
  briefs: ['production'],
  catalog: ['contracts', 'crm'],
  'client-portal': ['crm', 'design-budget', 'reservations'],
  clients: ['crm'],
  // ciclo con approvals y con integrations
  crm: ['approvals', 'integrations', 'process-templates', 'reservations'],
  'design-budget': ['production'],
  documents: ['integrations'],
  gamification: ['production'],
  intake: ['audiovisual', 'design-budget', 'production'],
  integrations: ['crm'],
  // ciclo con reservations: el más caro de los cuatro
  marketing: ['reservations'],
  meetings: ['integrations'],
  onboarding: ['process-templates'],
  // ciclos con approvals, briefs, design-budget y gamification
  production: ['approvals', 'billing', 'briefs', 'design-budget', 'gamification'],
  // ciclo con marketing
  reservations: ['integrations', 'marketing'],
  'service-requests': ['crm', 'reservations'],
  uploads: ['integrations'],
  users: ['crm'],
};

function modulos(): string[] {
  return readdirSync(MODULOS).filter((nombre) => statSync(join(MODULOS, nombre)).isDirectory());
}

function archivosTs(directorio: string, acumulado: string[] = []): string[] {
  for (const entrada of readdirSync(directorio, { withFileTypes: true })) {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) archivosTs(ruta, acumulado);
    else if (entrada.name.endsWith('.ts') && !entrada.name.endsWith('.spec.ts')) acumulado.push(ruta);
  }
  return acumulado;
}

/** A qué otros módulos de producto alcanza cada módulo, hoy, leyendo sus importaciones. */
function dependenciasReales(): Record<string, string[]> {
  const todos = modulos();
  const mapa: Record<string, string[]> = {};

  for (const modulo of todos) {
    const alcanzados = new Set<string>();
    for (const archivo of archivosTs(join(MODULOS, modulo))) {
      const texto = readFileSync(archivo, 'utf8');
      // Sube uno o dos niveles y entra a una carpeta: `../otro/` o `../../otro/`.
      for (const [, nombre] of texto.matchAll(/from '\.\.(?:\/\.\.)?\/([a-z-]+)\//g)) {
        if (nombre !== modulo && todos.includes(nombre) && !SUELO.includes(nombre)) alcanzados.add(nombre);
      }
    }
    if (alcanzados.size) mapa[modulo] = [...alcanzados].sort();
  }
  return mapa;
}

describe('fronteras entre módulos', () => {
  it('ningún módulo alcanza a uno que no esté declarado', () => {
    const real = dependenciasReales();
    const nuevas: string[] = [];

    for (const [modulo, alcanzados] of Object.entries(real)) {
      const permitidas = DEPENDENCIAS_DE_HOY[modulo] ?? [];
      for (const destino of alcanzados) {
        if (!permitidas.includes(destino)) nuevas.push(`${modulo} → ${destino}`);
      }
    }

    expect(nuevas, [
      'Estos módulos empezaron a alcanzar a otros:',
      ...nuevas.map((linea) => `  · ${linea}`),
      '',
      'Un módulo es un concepto, no una carpeta. Una reserva es un evento en un local y un lead es',
      'una relación comercial: si uno importa del otro, la distinción deja de estar en el código.',
      '',
      'En vez de importar, emite un evento. `core/events/handlers/` ya lo hace para CRM y',
      'Producción, con `@OnEvent`. Si de verdad hace falta la dependencia, agrégala a',
      '`DEPENDENCIAS_DE_HOY` con una línea que diga por qué.',
    ].join('\n')).toEqual([]);
  });

  /*
   * El otro lado de la pinza. Sin esto la lista se queda con dependencias ya cortadas y deja de
   * medir cuánto falta: una lista que no encoge no sirve de ratchet.
   */
  it('la lista no declara dependencias que ya no existen', () => {
    const real = dependenciasReales();
    const sobrantes: string[] = [];

    for (const [modulo, permitidas] of Object.entries(DEPENDENCIAS_DE_HOY)) {
      const alcanzados = real[modulo] ?? [];
      for (const destino of permitidas) {
        if (!alcanzados.includes(destino)) sobrantes.push(`${modulo} → ${destino}`);
      }
    }

    expect(sobrantes, [
      'Estas dependencias ya no existen. Sácalas de `DEPENDENCIAS_DE_HOY`:',
      ...sobrantes.map((linea) => `  · ${linea}`),
    ].join('\n')).toEqual([]);
  });

  /*
   * Reservas no debe alcanzar al CRM, y hoy no lo hace: el acoplamiento va al revés. Se fija
   * aparte de la lista general porque es la regla que el dueño del producto puso por escrito, y
   * conviene que falle con su propio nombre si alguien la rompe.
   */
  it('Reservas no alcanza al CRM', () => {
    expect(dependenciasReales().reservations ?? []).not.toContain('crm');
  });
});
