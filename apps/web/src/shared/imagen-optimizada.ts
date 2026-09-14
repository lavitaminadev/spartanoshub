/**
 * @fileoverview Entrega liviana de imágenes de Cloudinary.
 *
 * Vive aparte del componente de subida para que las páginas públicas la usen sin cargar el
 * selector de archivos ni la biblioteca de medios.
 */

/** Segmento de transformaciones de Cloudinary, como `f_auto,q_auto,c_limit,w_1600`. */
export const TRANSFORMACION = /^[a-z]{1,3}_[^/]*$/;

/**
 * Versión liviana de una imagen de Cloudinary: formato y calidad automáticos y sin pasar del ancho
 * pedido. Una foto de celular de 5 MB se entrega así en unos cientos de KB. Las URL externas o que
 * ya traen transformaciones se devuelven tal cual.
 */
export function optimizedUrl(url?: string, maxWidth?: number): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('cloudinary.com')) return url;
    const pathParts = parsed.pathname.split('/');
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex === -1 || TRANSFORMACION.test(pathParts[uploadIndex + 1] || '')) return url;
    pathParts.splice(uploadIndex + 1, 0, maxWidth ? `f_auto,q_auto,c_limit,w_${maxWidth}` : 'f_auto,q_auto');
    parsed.pathname = pathParts.join('/');
    return parsed.toString();
  } catch {
    return url;
  }
}
