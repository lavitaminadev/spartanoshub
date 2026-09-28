import { describe, expect, it } from 'vitest';
import { claveDeDocumento, documentoLegible, leerDocumento } from '@espartanos/shared';

/*
 * El documento se compara para reconocer a la misma persona, así que tiene que quedar igual
 * lo escriba como lo escriba. Y un turista tiene que poder reservar: el RUT sólo lo tienen
 * quienes viven en Chile.
 */
describe('documento de identidad', () => {
  describe('RUT', () => {
    it('queda igual con puntos, sin puntos o sin guion', () => {
      for (const escrito of ['rut:12.345.678-5', 'rut:12345678-5', 'rut:123456785', '12.345.678-5']) {
        expect(leerDocumento(escrito)).toEqual({ tipo: 'rut', pais: null, numero: '12345678-5' });
      }
    });

    it('la K queda en mayúscula', () => {
      expect(leerDocumento('rut:10.000.013-k')?.numero).toBe('10000013-K');
    });

    it('rechaza un dígito verificador que no corresponde', () => {
      expect(leerDocumento('rut:12.345.678-9')).toBeNull();
    });
  });

  describe('pasaporte', () => {
    it('se guarda en mayúsculas, sin espacios, con su país', () => {
      expect(leerDocumento('pasaporte:ar:ab 123-456')).toEqual({ tipo: 'pasaporte', pais: 'AR', numero: 'AB123456' });
    });

    it('sin país no vale: dos países pueden dar el mismo número a personas distintas', () => {
      expect(leerDocumento('pasaporte::AB123456')).toBeNull();
    });

    it('un número demasiado corto no vale', () => {
      expect(leerDocumento('pasaporte:AR:AB1')).toBeNull();
    });
  });

  it('un RUT y un pasaporte con los mismos dígitos no se confunden', () => {
    const rut = leerDocumento('rut:12345678-5')!;
    const pasaporte = leerDocumento('pasaporte:AR:123456785')!;
    expect(claveDeDocumento(rut)).not.toBe(claveDeDocumento(pasaporte));
  });

  it('se lee en pantalla con formato humano', () => {
    expect(documentoLegible('rut:12345678-5')).toBe('RUT 12.345.678-5');
    expect(documentoLegible('pasaporte:AR:AB123456')).toBe('Pasaporte (Argentina) AB123456');
  });

  it('vacío o basura no es un documento', () => {
    expect(leerDocumento('')).toBeNull();
    expect(leerDocumento(undefined)).toBeNull();
    expect(leerDocumento('hola')).toBeNull();
  });
});
