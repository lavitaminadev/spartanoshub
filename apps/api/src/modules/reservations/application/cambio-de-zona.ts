/**
 * @fileoverview Si una reserva puede moverse a otra zona del local.
 *
 * La zona la elige quien reserva sin conocer el local, y al recibir se corrige: llovió y la
 * terraza no sirve, o el grupo pidió cambiarse. El cupo de cada zona no es un contador guardado
 * sino la suma de lo que hay en ella a esa hora, así que mover la reserva libera la de origen por
 * sí sola; lo único que hay que comprobar es que en la de destino quepa.
 */

export interface ZonaDelLocal {
  id: string;
  name?: string;
  capacity?: number;
  active?: boolean;
}

export interface CambioDeZona {
  /** Zonas declaradas en la reserva, tal como las guarda su configuración. */
  zonas: ZonaDelLocal[];
  /** Zona a la que se quiere mover. */
  destino: string;
  /** Personas que ya ocupan esa zona en el mismo horario, sin contar esta reserva. */
  ocupado: number;
  /** Personas de la reserva que se mueve. */
  personas: number;
  /** Cupo por franja del local, que manda cuando la zona no declara el suyo. */
  capacidadDelLocal: number;
}

export interface ZonaRechazada {
  motivo: 'inexistente' | 'apagada' | 'sin-espacio';
  mensaje: string;
}

/**
 * @returns `null` cuando el cambio se puede hacer, o el motivo por el que no, con el texto que se
 *   le muestra a quien está atendiendo.
 */
export function evaluarCambioDeZona(cambio: CambioDeZona): ZonaRechazada | null {
  const zona = cambio.zonas.find((item) => item.id === cambio.destino);
  if (!zona) return { motivo: 'inexistente', mensaje: 'Esa zona no existe en esta reserva' };

  const nombre = zona.name?.trim() || 'Esa zona';
  if (zona.active === false) {
    return { motivo: 'apagada', mensaje: `${nombre} está apagada: enciéndela en los ajustes del día antes de asignarla` };
  }

  const cupo = Math.max(1, Number(zona.capacity) || cambio.capacidadDelLocal);
  if (cambio.ocupado + cambio.personas > cupo) {
    return { motivo: 'sin-espacio', mensaje: `${nombre} no tiene espacio a esa hora: ${cambio.ocupado} de ${cupo} ocupados` };
  }
  return null;
}
