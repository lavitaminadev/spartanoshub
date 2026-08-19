/**
 * @fileoverview Monograma de dos letras que acompaña cada entrada del menú.
 *
 * El glifo se deriva de la **etiqueta**, no del módulo ni de la ruta, porque es lo que el
 * usuario lee: el par de letras funciona como abreviatura de lo que dice al lado.
 *
 * Eso obliga a mantener este mapa junto con las etiquetas. Renombrar una entrada del menú sin
 * actualizarlo hace caer el respaldo (`label.slice(0, 2)`), que produce colisiones silenciosas:
 * dos entradas distintas con el mismo monograma, que es exactamente lo que el glifo debía
 * evitar. `NavGlyph.test.ts` comprueba que cada etiqueta registrada tenga el suyo y que no se
 * repitan, de modo que un renombrado futuro falle en las pruebas y no en la pantalla.
 */

const GLYPHS: Record<string, string> = {
  // Inicio
  Inicio: 'IN',

  // Ventas y CRM
  'Posibles clientes': 'PC',
  'Oportunidades de venta': 'OV',
  'Tablero de pipeline': 'TP',
  'Automatizaciones': 'AU',
  'Actividad comercial': 'AC',
  'Inicio del CRM': 'IC',
  'Contactos captados': 'CC',
  'Catálogo': 'CA',
  Contratos: 'CT',
  'Facturación': 'FA',

  // Clientes
  Clientes: 'CL',
  'Alta de clientes': 'AL',
  'Encargos del cliente': 'EC',
  Reuniones: 'RE',
  Documentos: 'DO',

  // Reservas
  Reservas: 'RS',
  'Agenda del día': 'AG',
  Disponibilidad: 'DP',
  'Lista de espera': 'LE',
  'Resultados de reservas': 'RR',

  // Trabajos
  Solicitudes: 'SO',
  'Producción': 'PR',
  'Video y fotografía': 'VF',
  'Logros del equipo': 'LG',
  Aprobaciones: 'AP',
  Contenido: 'CO',

  // Medición
  Encuestas: 'EN',
  Informes: 'IF',
  'Dirección': 'DI',

  // Administración
  'Accesos y seguridad': 'AS',
  Usuarios: 'US',
  'Operación y cuentas': 'OC',
  'Gobierno del producto': 'GP',
  'Configuración técnica': 'TC',
  'Mi configuración': 'MC',
  'Estado del sistema': 'ES',
  'Base de conocimiento': 'BC',
  Conexiones: 'CX',
  'Seguridad y privacidad': 'SG',

  // Portal de cliente
  Grilla: 'GR',
};

/** Monograma declarado para una etiqueta, o `undefined` si no tiene. */
export function glyphFor(label: string): string | undefined {
  return GLYPHS[label];
}

export function NavGlyph({ label }: { label: string }) {
  return <span className="nav-glyph" aria-hidden="true">{GLYPHS[label] ?? label.slice(0, 2).toUpperCase()}</span>;
}
