/**
 * Valores de muestra para ver una plantilla antes de que la reciba alguien real.
 *
 * Cubre las variables de todos los avisos juntas: la prueba no sabe cuál se está editando, y una
 * variable sin valor se borra al componer —dejaría la frase con un hueco que no se parece al
 * correo de verdad, que es justo lo que se quiere comprobar—.
 *
 * Son datos inventados y se nota que lo son. Usar un lead o una reserva reales expondría datos de
 * una persona en un correo de prueba, y además haría que la muestra dependiera de que existan.
 */
/**
 * Una fecha a unos días de hoy, en palabras.
 *
 * Una fecha fija en la muestra termina en el pasado —la anterior era un 4 de septiembre— y la
 * vista previa enseñaba una reserva vencida o un cupón que ya no valía.
 */
function enDias(dias: number, conHora = false): string {
  const fecha = new Date(Date.now() + dias * 86_400_000);
  const dia = fecha.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', weekday: conHora ? 'long' : undefined, day: 'numeric', month: 'long', year: 'numeric' });
  return conHora ? `${dia}, 20:30` : dia;
}

export const MUESTRA: Record<string, string | number> = {
  // Quien recibe el aviso, en los correos internos.
  responsable: 'María',
  // La persona de la que trata, en los que hablan de un tercero.
  nombre: 'Ana Pérez',
  lead: 'Ana Pérez',
  // Reservas.
  local: 'Restaurante de ejemplo',
  fecha: enDias(3, true),
  personas: 4,
  codigo: 'ABC-1234',
  motivo: 'Motivo: cierre por evento privado.',
  // Cupón de regalo.
  cupon: 'BIENVENIDA10',
  vence: enDias(30),
  // CRM.
  origen: 'Meta Lead Ads',
  campana: 'Campaña de ejemplo',
  telefono: '+56 9 1234 5678',
  correo: 'ana.perez@ejemplo.cl',
  etapa: 'Contactado - Recontactar',
  dias: 5,
  pendientes: 3,
  parados: 2,
  nuevos: 7,
  // Tareas.
  tarea: 'Llamar para confirmar la visita',
  cuando: 'hoy 18:00',
  horas: 3,
};
