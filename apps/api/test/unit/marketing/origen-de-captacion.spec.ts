import { describe, expect, it } from 'vitest';
import { origenDeCaptacion } from '../../../src/modules/marketing/origen-de-captacion';

/*
 * La procedencia de una dirección dejada en la página de novedades.
 *
 * Importa por dos razones distintas. Una es de negocio: con un enlace por sitio se puede comparar
 * el QR de la carta con el cartel del mesón, que antes era indistinguible. La otra es que este
 * texto llega por la dirección del navegador —lo escribe cualquiera— y termina en una tabla y en
 * una planilla descargable.
 */
describe('origen de una alta de captación', () => {
  it('sin canal queda sólo el local, como antes', () => {
    expect(origenDeCaptacion('Casa Costanera')).toBe('captación · Casa Costanera');
  });

  it('agrega el sitio y la campaña cuando vienen', () => {
    expect(origenDeCaptacion('Casa Costanera', 'qr-carta', 'verano'))
      .toBe('captación · Casa Costanera · qr-carta · campaña verano');
  });

  /* Lo que viene de la dirección se normaliza: dos carteles escritos distinto no son dos sitios. */
  it('normaliza mayúsculas, espacios y tildes', () => {
    expect(origenDeCaptacion('Casa', ' QR Mesón ')).toBe('captación · Casa · qr-mes-n');
  });

  /*
   * Una UTM ilegible se ignora y el alta se guarda igual: perder un consentimiento válido por una
   * procedencia rota sería el peor de los dos resultados posibles.
   */
  it('ignora lo que no deja nada legible', () => {
    for (const basura of ['', '   ', '!!!', '---']) {
      expect(origenDeCaptacion('Casa', basura)).toBe('captación · Casa');
    }
  });

  /* No se guarda crudo: es texto ajeno que se va a mostrar en una tabla. */
  it('recorta un canal largo a cuarenta caracteres', () => {
    const resultado = origenDeCaptacion('Casa', 'a'.repeat(200));
    expect(resultado).toBe(`captación · Casa · ${'a'.repeat(40)}`);
  });

  it('nunca pasa del largo de la columna', () => {
    expect(origenDeCaptacion('L'.repeat(300), 'qr-mesa', 'verano').length).toBeLessThanOrEqual(255);
  });
});
