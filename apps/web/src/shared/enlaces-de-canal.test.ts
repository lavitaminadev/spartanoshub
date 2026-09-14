import { describe, expect, it } from 'vitest';
import { CANALES, enlaceCorto, enlaceConUtm, limpiarUtm } from './PanelCompartir';
import { medioDeFuente } from './EnlaceDeCanal';
import { CONTENIDO_DETECTADO, detectarOrigen } from './origen-automatico';

/*
 * Los QR y enlaces ya impresos o publicados dependen de estos valores. Si una prueba de este
 * archivo falla, un cambio estaría rompiendo enlaces que la gente ya tiene en la mano: no se
 * ajusta la prueba, se mantiene la compatibilidad.
 */
describe('enlaces por canal: estables en el tiempo', () => {
  it('mantiene los códigos de canal publicados', () => {
    expect(CANALES.map((canal) => `${canal.fuente}:${canal.medio}`)).toEqual([
      'whatsapp:social', 'instagram:social', 'facebook:social', 'google:maps', 'sitio-web:referral', 'correo:email',
    ]);
  });

  it('arma el enlace corto con el canal y la campaña en la ruta', () => {
    expect(enlaceCorto('https://cuartel.espartanos.cl/book/casa-costanera', 'qr-mesa')).toBe('https://cuartel.espartanos.cl/book/casa-costanera/qr-mesa');
    expect(enlaceCorto('https://cuartel.espartanos.cl/book/casa-costanera/', 'whatsapp', 'dia-madre')).toBe('https://cuartel.espartanos.cl/book/casa-costanera/whatsapp/dia-madre');
    expect(enlaceCorto('https://cuartel.espartanos.cl/survey/abc', 'instagram')).toBe('https://cuartel.espartanos.cl/survey/abc/instagram');
  });

  it('usa la forma larga si la dirección base ya trae parámetros', () => {
    expect(enlaceCorto('https://x.cl/book/a?lang=es', 'qr-mesa')).toBe('https://x.cl/book/a?lang=es&utm_source=qr-mesa&utm_medium=qr');
  });

  it('traduce cada canal al mismo medio al abrirse', () => {
    expect(medioDeFuente('whatsapp')).toBe('social');
    expect(medioDeFuente('google')).toBe('maps');
    expect(medioDeFuente('qr-vitrina')).toBe('qr');
    expect(medioDeFuente('influencer-camila')).toBe('referral');
  });

  it('limpia textos para UTM y conserva lo ya existente', () => {
    expect(limpiarUtm('Día de la Madre!')).toBe('dia-de-la-madre');
    expect(enlaceConUtm('https://x.cl/a?b=1', 'web', 'referral', 'c')).toBe('https://x.cl/a?b=1&utm_source=web&utm_medium=referral&utm_campaign=c');
  });
});

describe('detección automática del origen', () => {
  const HOST = 'cuartel.espartanos.cl';
  const CHROME = 'Mozilla/5.0 (Linux; Android 14) Chrome/126 Mobile Safari/537.36';

  it('nunca pisa una UTM escrita', () => {
    expect(detectarOrigen('?utm_source=qr-mesa&fbclid=1', 'https://instagram.com/', 'Instagram 300', HOST)).toBeNull();
  });

  it('reconoce anuncios y navegadores de apps', () => {
    expect(detectarOrigen('?gclid=abc', '', CHROME, HOST)).toEqual({ source: 'google', medium: 'cpc', content: CONTENIDO_DETECTADO });
    expect(detectarOrigen('?fbclid=abc', '', 'Mozilla/5.0 Instagram 312.0', HOST)?.source).toBe('instagram');
    expect(detectarOrigen('?fbclid=abc', '', CHROME, HOST)?.source).toBe('facebook');
    expect(detectarOrigen('', '', 'Mozilla/5.0 [FBAN/FBIOS;FBAV/450]', HOST)?.source).toBe('facebook');
  });

  it('usa la página de origen y separa Google Maps de la búsqueda', () => {
    expect(detectarOrigen('', 'https://www.google.com/maps/place/x', CHROME, HOST)).toMatchObject({ source: 'google', medium: 'maps' });
    expect(detectarOrigen('', 'https://www.google.cl/', CHROME, HOST)).toMatchObject({ source: 'google', medium: 'organic' });
    expect(detectarOrigen('', 'https://l.instagram.com/?u=x', CHROME, HOST)).toMatchObject({ source: 'instagram', medium: 'social' });
    expect(detectarOrigen('', 'https://www.casacostanera.cl/menu', CHROME, HOST)).toMatchObject({ source: 'casacostanera.cl', medium: 'referral' });
  });

  it('deja como directo lo que no deja rastro o viene del mismo sitio', () => {
    expect(detectarOrigen('', '', CHROME, HOST)).toBeNull();
    expect(detectarOrigen('', 'https://cuartel.espartanos.cl/book/otro', CHROME, HOST)).toBeNull();
    expect(detectarOrigen('', 'no-es-url', CHROME, HOST)).toBeNull();
  });
});
