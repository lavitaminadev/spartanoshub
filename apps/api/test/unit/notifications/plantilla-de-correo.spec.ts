import { describe, expect, it } from 'vitest';
import {
  armazonDeCorreo,
  componerCorreo,
  escaparHtml,
  rellenar,
} from '../../../src/core/notifications/plantilla-de-correo';

/**
 * El armazón por el que pasan todos los correos del sistema.
 *
 * Lo que se comprueba acá no es que el HTML sea bonito, sino que una persona editando una
 * plantilla no pueda romper el correo ni convertirlo en un vector de inyección. Es la única capa
 * entre un texto que escribe cualquiera y una bandeja de entrada ajena.
 */
describe('plantillas de correo', () => {
  it('sustituye las variables por su valor', () => {
    expect(rellenar('Hola {{nombre}}, van {{dias}} días.', { nombre: 'Ana', dias: 4 }))
      .toBe('Hola Ana, van 4 días.');
  });

  it('tolera espacios dentro de las llaves, que es como se escribe a mano', () => {
    expect(rellenar('Hola {{ nombre }}', { nombre: 'Ana' })).toBe('Hola Ana');
  });

  /*
   * Dejar `{{responsable}}` a la vista en un correo real es peor que la frase incompleta: delata
   * que algo falló y nadie sabe qué era.
   */
  it.each([
    ['ausente', {}],
    ['nula', { nombre: null }],
    ['vacía', { nombre: '' }],
  ])('una variable %s se borra en vez de quedar visible', (_caso, variables) => {
    const salida = rellenar('Hola {{nombre}}.', variables);
    expect(salida).toBe('Hola .');
    expect(salida).not.toContain('{{');
  });

  it('escapa lo que se sustituye: un nombre no puede inyectar HTML', () => {
    const salida = rellenar('Hola {{nombre}}', { nombre: '<script>alert(1)</script>' });

    expect(salida).not.toContain('<script>');
    expect(salida).toContain('&lt;script&gt;');
  });

  it.each([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;'],
  ])('escapa «%s»', (entrada, esperado) => {
    expect(escaparHtml(entrada)).toBe(esperado);
  });

  it('convierte los saltos en párrafos, que es como se escribió el texto', () => {
    const html = armazonDeCorreo('Título', 'Primero.\n\nSegundo.\nMisma línea.');

    expect(html).toContain('<p style="margin:0 0 14px;">Primero.</p>');
    expect(html).toContain('Segundo.<br>Misma línea.');
  });

  /*
   * El correo se abre casi siempre en un teléfono, y el HTML de correo no admite hojas de estilo
   * externas: si estas dos cosas se pierden, el mensaje llega ilegible sin que nada falle.
   */
  it('el armazón trae lo que hace falta para leerlo en un teléfono', () => {
    const html = armazonDeCorreo('Título', 'Cuerpo');

    expect(html).toContain('width=device-width');
    expect(html).toContain('max-width:560px');
  });

  it('el logo lleva texto de reemplazo, porque muchos clientes bloquean las imágenes', () => {
    const html = armazonDeCorreo('Título', 'Cuerpo');

    expect(html).toContain('alt="Espartanos"');
  });

  it('el botón solo aparece cuando hay algo que hacer', () => {
    expect(armazonDeCorreo('T', 'C')).not.toContain('<a href');
    expect(armazonDeCorreo('T', 'C', { texto: 'Abrir', url: 'https://x.cl/a' }))
      .toContain('https://x.cl/a');
  });

  it('compone asunto y cuerpo de una vez', () => {
    const { subject, html } = componerCorreo(
      '{{lead}} lleva {{dias}} días sin avanzar',
      'Hola {{responsable}}:\n\n«{{lead}}» sigue en {{etapa}}.',
      { lead: 'Ana Pérez', dias: 7, responsable: 'Maxi', etapa: 'Contactado' },
    );

    expect(subject).toBe('Ana Pérez lleva 7 días sin avanzar');
    expect(html).toContain('Maxi');
    expect(html).toContain('Contactado');
  });

  /*
   * El asunto no es HTML. Escaparlo dejaría «Ana &amp; Juan» en la bandeja de entrada, que se lee
   * como el error que es.
   */
  it('el asunto no se escapa, porque no es HTML', () => {
    const { subject } = componerCorreo('Reunión con {{quien}}', 'x', { quien: 'Ana & Juan' });

    expect(subject).toBe('Reunión con Ana & Juan');
  });

  it('el asunto queda en una sola línea aunque la plantilla traiga saltos', () => {
    const { subject } = componerCorreo('Aviso\n  de   {{quien}}', 'x', { quien: 'Ana' });

    expect(subject).toBe('Aviso de Ana');
  });
});
