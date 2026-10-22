/**
 * @fileoverview Reglas de las exportaciones de Reservas.
 *
 * Sacar la base entera y sacar la noche del sábado son actos distintos. Aquí se decide cuándo una
 * exportación exige un motivo escrito, cómo se rotula el archivo y qué hoja puede imprimirse.
 */

import { columnasAQuitar } from '@espartanos/shared';
import type { NivelesDeDatos } from '../../../core/client-scope/nivel-de-datos.service';

/** Más filas que esto y la exportación deja de ser «la noche de ayer». */
export const FILAS_QUE_EXIGEN_MOTIVO = 500;
/** Un rango más largo que esto —o sin límites— es sacar historial, no preparar un turno. */
export const DIAS_QUE_EXIGEN_MOTIVO = 31;
export const MOTIVO_MINIMO = 10;
export const MOTIVO_MAXIMO = 500;

export interface VolumenDeExportacion {
  filas: number;
  desde?: string;
  hasta?: string;
}

/**
 * Por qué una exportación exige motivo. Lista vacía si no lo exige.
 *
 * `conProtegidos` es que el archivo lleve contacto, identificadores o las respuestas del
 * formulario: el nivel `directo` permite verlos, pero llevárselos fuera del sistema exige decir para qué.
 */
export function razonesParaExigirMotivo(volumen: VolumenDeExportacion, conProtegidos: boolean): string[] {
  const razones: string[] = [];
  if (conProtegidos) razones.push('incluye datos de contacto o respuestas del formulario');
  if (volumen.filas > FILAS_QUE_EXIGEN_MOTIVO) razones.push(`tiene más de ${FILAS_QUE_EXIGEN_MOTIVO} filas`);

  const desde = volumen.desde ? new Date(volumen.desde).getTime() : NaN;
  const hasta = volumen.hasta ? new Date(volumen.hasta).getTime() : NaN;
  if (Number.isNaN(desde) || Number.isNaN(hasta)) razones.push('no acota el rango de fechas');
  else if ((hasta - desde) / 86_400_000 > DIAS_QUE_EXIGEN_MOTIVO) razones.push(`abarca más de ${DIAS_QUE_EXIGEN_MOTIVO} días`);
  return razones;
}

/** El motivo limpio, o `undefined` si no es un motivo (vacío o demasiado corto para decir algo). */
export function motivoEscrito(motivo?: string): string | undefined {
  const limpio = (motivo ?? '').replace(/\s+/g, ' ').trim();
  return limpio.length >= MOTIVO_MINIMO ? limpio.slice(0, MOTIVO_MAXIMO) : undefined;
}

/** La primera fila de la planilla. En un CSV rompería a los lectores; en xlsx no. */
export function marcaDeExportacion(quien: string, cuando: Date): string {
  const fecha = cuando.toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Santiago' });
  return `Exportado por ${quien} el ${fecha} · contiene datos personales · uso interno`;
}

export const AVISO_DE_RESTRICCIONES = 'Tiene restricciones · ver en pantalla';

const CLAVES_DE_RESTRICCION = new Set(['dietaryNotes', 'accessibilityNeed']);
const PALABRAS_DE_RESTRICCION = /alerg|restric|diet|celiac|celíac|intoler|vegan|vegetar|accesib|movilidad|silla de ruedas/i;
const SIN_RESTRICCION = /^(no|ninguna?|nada|n\/a|-|sin restricciones?)$/i;

/**
 * Si la reserva declara alguna restricción alimentaria o de accesibilidad.
 *
 * Sólo responde sí o no: el contenido de lo declarado es dato de salud y no puede salir en papel.
 */
export function tieneRestricciones(answers: unknown, etiquetaDe: (clave: string) => string): boolean {
  if (!answers || typeof answers !== 'object') return false;
  return Object.entries(answers as Record<string, unknown>).some(([clave, valor]) => {
    const texto = Array.isArray(valor) ? valor.join(', ') : typeof valor === 'string' ? valor : '';
    if (!texto.trim() || SIN_RESTRICCION.test(texto.trim())) return false;
    return CLAVES_DE_RESTRICCION.has(clave) || PALABRAS_DE_RESTRICCION.test(`${clave} ${etiquetaDe(clave)}`);
  });
}

/**
 * Columnas que lleva el archivo, según cuánto ve de los datos protegidos quien lo pide.
 *
 * Correo, teléfono y las respuestas del formulario sólo salen si su nivel se los permite, y
 * `conProtegidos` dice si el archivo acabó llevando alguno: es lo que decide si la exportación
 * exige motivo escrito.
 *
 * Vive aquí y no en el servicio porque no consulta nada: son las reglas del archivo, y así se
 * pueden probar sin levantar el módulo entero.
 */
export function columnasDelCsv(
  niveles: NivelesDeDatos,
  clientId?: string,
  clientIds?: string[],
): { columnas: string[]; conProtegidos: boolean } {
  const quitar = new Set(columnasAQuitar('reservations', niveles.deTodas(clientId ? [clientId] : clientIds)));
  const base = ['codigo', 'nombre', 'fecha', 'estado', 'origen', 'medio', 'campana', 'contenido', 'cupon', 'personas', 'notas_internas'];
  const protegidas = [['correo', 'guestEmail'], ['telefono', 'guestPhone']].filter(([, campo]) => !quitar.has(campo)).map(([nombre]) => nombre);
  const respuestas = quitar.has('answers') ? [] : ['respuestas_del_formulario'];
  return { columnas: [...base, ...protegidas, ...respuestas], conProtegidos: protegidas.length > 0 || respuestas.length > 0 };
}
