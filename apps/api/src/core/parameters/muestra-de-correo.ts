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
export const MUESTRA: Record<string, string | number> = {
  // Quien recibe el aviso, en los correos internos.
  responsable: 'María',
  // La persona de la que trata, en los que hablan de un tercero.
  nombre: 'Ana Pérez',
  lead: 'Ana Pérez',
  // Reservas.
  local: 'Restaurante de ejemplo',
  fecha: 'jueves 4 de septiembre de 2026, 20:30',
  personas: 4,
  codigo: 'ABC-1234',
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
