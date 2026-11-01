/**
 * Lo que anota quien revisa la maqueta, vista por vista.
 *
 * La maqueta no tiene servidor: lo que se escribe acá vive en el navegador de quien revisa y no
 * llega a ninguna parte por sí solo. Por eso existe la exportación: al terminar, el revisor se
 * lleva un texto con todo lo que anotó y lo manda por donde quiera. Guardarlo en el navegador y
 * exportarlo a mano es la única forma honesta de recoger retroalimentación sin levantar nada.
 *
 * Las anotaciones se guardan por ruta y título, no por posición en el guion: añadir un paso en
 * medio no debe mover de sitio lo que alguien ya escribió.
 */

const CLAVE = 'espartanos.maqueta.observaciones';
const CLAVE_VISTAS = 'espartanos.maqueta.vistas';

export interface Observacion {
  /** `ok` es «la vi y está bien»; `nota` es «la vi y tengo algo que decir». */
  estado: 'ok' | 'nota';
  texto?: string;
  cuando: string;
}

/** La identidad de una vista, estable frente a cambios de orden del guion. */
export function claveDelPaso(paso: { ruta: string; titulo: string }): string {
  return `${paso.ruta}|${paso.titulo}`;
}

function leerMapa<T>(clave: string): Record<string, T> {
  try {
    const crudo = window.localStorage.getItem(clave);
    const valor: unknown = crudo ? JSON.parse(crudo) : null;
    return valor && typeof valor === 'object' ? (valor as Record<string, T>) : {};
  } catch {
    return {};
  }
}

function escribirMapa(clave: string, mapa: unknown): void {
  try { window.localStorage.setItem(clave, JSON.stringify(mapa)); } catch { /* sin almacenamiento */ }
}

export function leerObservaciones(): Record<string, Observacion> {
  return leerMapa<Observacion>(CLAVE);
}

export function guardarObservacion(clave: string, estado: 'ok' | 'nota', texto?: string): Record<string, Observacion> {
  const mapa = leerObservaciones();
  mapa[clave] = { estado, texto: texto?.trim() || undefined, cuando: new Date().toISOString() };
  escribirMapa(CLAVE, mapa);
  return mapa;
}

export function borrarObservacion(clave: string): Record<string, Observacion> {
  const mapa = leerObservaciones();
  delete mapa[clave];
  escribirMapa(CLAVE, mapa);
  return mapa;
}

/** Las vistas que alguien llegó a abrir, aunque no haya dicho nada de ellas. */
export function leerVistas(): Record<string, true> {
  return leerMapa<true>(CLAVE_VISTAS);
}

export function marcarVista(clave: string): Record<string, true> {
  const mapa = leerVistas();
  if (mapa[clave]) return mapa;
  mapa[clave] = true;
  escribirMapa(CLAVE_VISTAS, mapa);
  return mapa;
}

/**
 * El texto que se lleva el revisor.
 *
 * Sale ordenado por flujo y con la vista nombrada como la nombra el recorrido, para que quien lo
 * reciba pueda ir a verla sin tener que preguntar a qué pantalla se refería cada comentario.
 */
export function componerInforme(
  flujos: { id: string; nombre: string }[],
  pasos: { ruta: string; titulo: string; flujos: string[] }[],
): string {
  const observaciones = leerObservaciones();
  const vistas = leerVistas();
  const lineas: string[] = [
    '# Revisión de la maqueta',
    '',
    `Fecha: ${new Date().toLocaleString('es-CL')}`,
    `Vistas abiertas: ${Object.keys(vistas).length} de ${pasos.length}`,
    '',
  ];

  const conNota = Object.entries(observaciones).filter(([, o]) => o.estado === 'nota');
  lineas.push(`Vistas con observación: ${conNota.length}`, '');

  for (const flujo of flujos) {
    const delFlujo = pasos.filter((paso) => paso.flujos.includes(flujo.id));
    const anotados = delFlujo.filter((paso) => observaciones[claveDelPaso(paso)]);
    if (anotados.length === 0) continue;
    lineas.push(`## ${flujo.nombre}`, '');
    for (const paso of anotados) {
      const o = observaciones[claveDelPaso(paso)];
      lineas.push(`- **${paso.titulo}** (\`${paso.ruta}\`) — ${o.estado === 'ok' ? 'sin observaciones' : 'con observación'}`);
      if (o.texto) for (const parrafo of o.texto.split('\n')) lineas.push(`  ${parrafo}`);
    }
    lineas.push('');
  }

  const sinAbrir = pasos.filter((paso) => !vistas[claveDelPaso(paso)]);
  if (sinAbrir.length > 0) {
    lineas.push('## Vistas que no se abrieron', '');
    for (const paso of sinAbrir) lineas.push(`- ${paso.titulo} (\`${paso.ruta}\`)`);
    lineas.push('');
  }

  return lineas.join('\n');
}

/**
 * El informe recortado a lo que alguien escribió, para que quepa en un correo o un mensaje.
 *
 * El informe completo lista también las vistas sin abrir, que son útiles en un archivo y ruido en
 * el cuerpo de un correo. Y una dirección `mailto` larga la recortan algunos clientes sin avisar:
 * lo que no cabe se pierde en silencio, así que acá va sólo lo que el revisor dijo.
 */
export function componerResumen(
  pasos: { ruta: string; titulo: string }[],
): { asunto: string; cuerpo: string } {
  const observaciones = leerObservaciones();
  const lineas: string[] = [];
  let conNota = 0;

  for (const paso of pasos) {
    const o = observaciones[claveDelPaso(paso)];
    if (!o) continue;
    if (o.estado === 'ok') { lineas.push(`• ${paso.titulo}: sin observaciones`); continue; }
    conNota += 1;
    lineas.push(`• ${paso.titulo} (${paso.ruta}):`, `  ${o.texto ?? 'con observación'}`);
  }

  const vistas = Object.keys(leerVistas()).length;
  return {
    asunto: `Revisión de la maqueta: ${conNota} ${conNota === 1 ? 'observación' : 'observaciones'}`,
    cuerpo: lineas.length === 0
      ? 'Revisé la maqueta y no anoté nada todavía.'
      : [`Revisé ${vistas} de ${pasos.length} vistas.`, '', ...lineas].join('\n'),
  };
}

/** Deja el informe en el portapapeles y además lo descarga, porque uno de los dos puede fallar. */
export async function entregarInforme(texto: string): Promise<'copiado' | 'descargado'> {
  let copiado = false;
  try {
    await navigator.clipboard.writeText(texto);
    copiado = true;
  } catch { /* sin permiso de portapapeles */ }

  try {
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/markdown' }));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = 'revision-de-la-maqueta.md';
    enlace.click();
    URL.revokeObjectURL(url);
  } catch { /* sin descargas */ }

  return copiado ? 'copiado' : 'descargado';
}
