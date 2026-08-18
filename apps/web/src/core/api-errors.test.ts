import { describe, expect, it } from 'vitest';
import { describeFieldError } from './api';

/**
 * El servidor responde `{ field, message }` por cada campo inválido, con el mensaje en inglés
 * de `class-validator` y el nombre de la propiedad del DTO.
 *
 * Antes se descartaba `field` y solo se mostraba el mensaje: un formulario con varias casillas
 * devolvía «must be a UUID» sin decir cuál, y todos los fallos se veían iguales.
 */
describe('errores de validación del servidor', () => {
  it('dice de qué campo se trata, con el nombre que se ve en pantalla', () => {
    expect(describeFieldError({ field: 'clientId', message: 'clientId must be a UUID' }))
      .toBe('Cliente: debe seleccionarse de la lista');
  });

  it('traduce el campo obligatorio', () => {
    expect(describeFieldError({ field: 'title', message: 'title should not be empty' }))
      .toBe('Título: es obligatorio');
  });

  /**
   * `forbidNonWhitelisted` rechaza cualquier campo que el DTO no declare. El mensaje original
   * —«property X should not exist»— describe el problema desde el servidor y no dice nada a
   * quien está llenando un formulario.
   */
  it('explica el campo que sobra sin hablar de propiedades', () => {
    expect(describeFieldError({ field: 'id', message: 'property id should not exist' }))
      .toBe('id: no corresponde a este formulario');
  });

  it('traduce fechas y números', () => {
    expect(describeFieldError({ field: 'dueAt', message: 'dueAt must be a valid ISO 8601 date string' }))
      .toBe('Vencimiento: debe ser una fecha válida');
    expect(describeFieldError({ field: 'amount', message: 'amount must be a number conforming to the specified constraints' }))
      .toBe('Monto: debe ser un número');
  });

  it('deja pasar el mensaje original cuando no hay traducción', () => {
    expect(describeFieldError({ field: 'stage', message: 'algo muy específico del dominio' }))
      .toBe('Etapa: algo muy específico del dominio');
  });

  it('usa el nombre técnico cuando el campo no está en el diccionario', () => {
    expect(describeFieldError({ field: 'carouselSlides', message: 'carouselSlides must be a number' }))
      .toBe('carouselSlides: debe ser un número');
  });

  it('funciona sin campo', () => {
    expect(describeFieldError({ message: 'Validation failed' })).toBe('Validation failed');
  });
});
