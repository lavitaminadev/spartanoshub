import { describe, expect, it } from 'vitest';
import { htmlDeVistaPrevia, imagenParaCompartir, primeraImagen } from '../../../src/shared/vista-previa-de-enlace';

describe('vista previa de enlaces', () => {
  it('pone título, descripción, imagen y lleva a la página real', () => {
    const html = htmlDeVistaPrevia({ titulo: 'Casa "Costanera"', descripcion: 'Reserva <tu> mesa', url: 'https://cuartel.espartanos.cl/book/casa', imagen: 'https://x.cl/a.jpg' });
    expect(html).toContain('<meta property="og:title" content="Casa &quot;Costanera&quot;">');
    expect(html).toContain('content="Reserva &lt;tu&gt; mesa"');
    expect(html).toContain('<meta property="og:image" content="https://x.cl/a.jpg">');
    expect(html).toContain('<meta http-equiv="refresh" content="0;url=https://cuartel.espartanos.cl/book/casa">');
    expect(html).toContain('summary_large_image');
  });

  it('sin imagen válida no inventa una', () => {
    const html = htmlDeVistaPrevia({ titulo: 'Encuesta', descripcion: 'Hola', url: 'https://cuartel.espartanos.cl/survey/1' });
    expect(html).not.toContain('og:image');
    expect(html).toContain('content="summary"');
  });

  it('usa sólo imágenes HTTPS y recorta las de Cloudinary a 1200×630', () => {
    expect(imagenParaCompartir('data:image/svg+xml;utf8,xx')).toBeNull();
    expect(imagenParaCompartir('http://x.cl/a.jpg')).toBeNull();
    expect(imagenParaCompartir('https://res.cloudinary.com/demo/image/upload/v1/portada.png')).toBe('https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/v1/portada.png');
    expect(primeraImagen(undefined, 'data:x', 'https://x.cl/logo.png')).toBe('https://x.cl/logo.png');
  });
});
