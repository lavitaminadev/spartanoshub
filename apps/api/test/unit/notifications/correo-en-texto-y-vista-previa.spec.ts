import { describe, expect, it } from 'vitest';
import { componerCorreo, textoDesdeHtml } from '../../../src/core/notifications/plantilla-de-correo';

/*
 * Un correo sólo en HTML cae en spam mucho mas seguido, y era lo que enviabamos en todos.
 * La version en texto va en el envio y no en cada sitio que compone un correo: son veintitres, y
 * dejar uno fuera no falla -simplemente ese correo llega peor-, que es de lo mas dificil de notar.
 */
describe('la carta en texto', () => {
  const armado = componerCorreo(
    'Tu reserva en {{local}}',
    'Hola {{nombre}}:\n\nTe esperamos el {{cuando}}.\n\nSi no puedes venir, avísanos.',
    { local: 'Casa Costanera', nombre: 'Ana', cuando: 'viernes a las 21:00' },
    { texto: 'Ver mi reserva', url: 'https://cuartel.espartanos.cl/r/abc' },
    undefined,
    [{ etiqueta: 'Personas', valor: '4' }],
  );

  it('trae las tres versiones y el asunto con sus variables puestas', () => {
    expect(armado.subject).toBe('Tu reserva en Casa Costanera');
    expect(armado.text).toContain('Hola Ana:');
    expect(armado.html).toContain('Hola Ana:');
  });

  it('el botón en texto es su dirección escrita: no hay dónde hacer clic', () => {
    expect(armado.text).toContain('Ver mi reserva: https://cuartel.espartanos.cl/r/abc');
  });

  it('lleva el detalle y la firma', () => {
    expect(armado.text).toContain('Personas: 4');
    expect(armado.text.trim().length).toBeGreaterThan(40);
  });

  it('no lleva ni una etiqueta de HTML', () => {
    expect(armado.text).not.toMatch(/<[a-z/]/i);
  });
});

describe('el texto derivado del HTML, que es el que se envía', () => {
  const { html } = componerCorreo(
    'Recupera tu acceso',
    'Hola Ana:\n\nEntra en {{enlace}} para crear tu clave.',
    { enlace: 'https://cuartel.espartanos.cl/login' },
    { texto: 'Crear mi clave', url: 'https://cuartel.espartanos.cl/login' },
  );
  const texto = textoDesdeHtml(html);

  it('conserva la carta', () => {
    expect(texto).toContain('Recupera tu acceso');
    expect(texto).toContain('Hola Ana:');
  });

  it('deja el botón como texto y dirección', () => {
    expect(texto).toContain('Crear mi clave: https://cuartel.espartanos.cl/login');
  });

  it('no arrastra el bloque oculto de vista previa ni sus caracteres invisibles', () => {
    expect(texto).not.toContain(' ');
    expect(texto).not.toContain('﻿');
    // La primera frase aparece una vez -en la carta-, no dos.
    expect(texto.split('Hola Ana:').length - 1).toBe(1);
  });

  it('no deja etiquetas ni estilos sueltos', () => {
    expect(texto).not.toMatch(/<[a-z/]/i);
    expect(texto).not.toContain('font-family');
    expect(texto).not.toContain('@media');
  });
});

describe('la vista previa de la bandeja', () => {
  it('adelanta la primera frase del correo', () => {
    const { html } = componerCorreo('Asunto', 'Tu mesa está confirmada.\n\nOtra línea.', {});
    expect(html).toContain('Tu mesa está confirmada.');
    // Va oculta: se lee en la lista de correos, no dentro del mensaje.
    expect(html).toContain('display:none');
  });

  it('un cuerpo vacío no rompe nada', () => {
    expect(() => componerCorreo('Asunto', '', {})).not.toThrow();
  });
});
