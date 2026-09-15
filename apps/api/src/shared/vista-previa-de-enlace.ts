/**
 * @fileoverview Página mínima con las etiquetas que leen WhatsApp, Facebook, Instagram y otras apps
 * al pegar un enlace: título, descripción e imagen.
 *
 * La web pública es una aplicación de una sola página: su HTML es igual para todas las rutas y
 * los lectores de vista previa no ejecutan JavaScript, así que un enlace de reservas o encuestas
 * se mostraba sin nombre ni imagen. El servidor web redirige a esos lectores hacia esta página;
 * una persona que llegue aquí es enviada de inmediato a la página real.
 */

export interface VistaPrevia {
  titulo: string;
  descripcion: string;
  /** URL pública de la página real, la que se comparte. */
  url: string;
  imagen?: string | null;
  sitio?: string;
}

const escapar = (texto: string) => texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Imagen apta para vista previa: sólo HTTPS (no imágenes incrustadas) y, si es de Cloudinary,
 * recortada a 1200×630 en JPG, que es lo que WhatsApp y Facebook muestran completo y cargan rápido.
 */
export function imagenParaCompartir(url?: string | null): string | null {
  if (!url || !/^https:\/\//i.test(url) || url.length > 2048) return null;
  if (/res\.cloudinary\.com\/.+\/image\/upload\//.test(url)) return url.replace('/image/upload/', '/image/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/');
  return url;
}

/** Primera imagen HTTPS disponible entre las candidatas, en orden de preferencia. */
export function primeraImagen(...candidatas: Array<string | null | undefined>): string | null {
  for (const candidata of candidatas) {
    const imagen = imagenParaCompartir(candidata);
    if (imagen) return imagen;
  }
  return null;
}

/** HTML con Open Graph y Twitter Card, que además lleva a la página real a quien lo abra. */
export function htmlDeVistaPrevia({ titulo, descripcion, url, imagen, sitio = 'Espartanos' }: VistaPrevia): string {
  const t = escapar(titulo.slice(0, 120));
  const d = escapar(descripcion.replace(/\s+/g, ' ').trim().slice(0, 300));
  const u = escapar(url);
  const img = imagen ? escapar(imagen) : '';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapar(sitio)}">
<meta property="og:locale" content="es_CL">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
${img ? `<meta property="og:image" content="${img}">
<meta property="og:image:secure_url" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${t}">` : ''}
<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
${img ? `<meta name="twitter:image" content="${img}">` : ''}
<link rel="canonical" href="${u}">
<meta http-equiv="refresh" content="0;url=${u}">
</head>
<body><a href="${u}">${t}</a></body>
</html>`;
}
