import { describe, expect, it } from 'vitest';
import {
  AVISO_MEDICION,
  DOCUMENTOS_DE_ESPARTANOS,
  OPERADOR_ESPARTANOS,
  PLAZOS_DE_CONSERVACION,
  TEXTO_MEDICION,
  documentoATexto,
  documentoDeEspartanos,
  faltantesDeIdentidadLegal,
  politicaDePrivacidadDelLocal,
  textosDeAceptacionDeReserva,
  traeDatosSensibles,
} from '@espartanos/shared';
import { exigirIdentidadLegalDeEncuesta } from '../../../src/modules/surveys/consentimiento-de-encuesta';

const LOCAL = { razonSocial: 'Casa SpA', rut: '76.086.428-5', correo: 'priv@casa.cl', nombreComercial: 'Casa Costanera' };

describe('documentos legales de Espartanos', () => {
  it('siempre existen, con versión y sin datos inventados', () => {
    for (const { id } of DOCUMENTOS_DE_ESPARTANOS) {
      const texto = documentoATexto(documentoDeEspartanos(id));
      expect(texto).toContain('Versión legal-');
      expect(texto).not.toMatch(/null|undefined|XX\.XXX|lorem|\[.*\]/i);
    }
    expect(documentoATexto(documentoDeEspartanos('privacidad'))).toContain(OPERADOR_ESPARTANOS.correo);
  });

  it('publica los mismos plazos que usa el borrado automático', () => {
    const texto = documentoATexto(documentoDeEspartanos('privacidad'));
    expect(texto).toContain(`Hasta ${PLAZOS_DE_CONSERVACION.reservasMeses} meses después de la visita`);
    expect(texto).toContain(`${PLAZOS_DE_CONSERVACION.medicionMeses} meses en la plataforma`);
  });

  it('la política generada del local usa sus datos reales y nombra a Espartanos como encargado', () => {
    const texto = documentoATexto(politicaDePrivacidadDelLocal(LOCAL));
    expect(texto).toContain('Casa SpA, RUT 76.086.428-5 («Casa Costanera»)');
    expect(texto).toContain('priv@casa.cl');
    expect(texto).toContain('por nuestro encargo');
  });

  it('la medición dice que se envían datos cifrados, no «agregados»', () => {
    expect(TEXTO_MEDICION).toContain('cifrados');
    expect(AVISO_MEDICION).not.toContain('agregada');
  });

  it('la casilla obligatoria acepta condiciones; las opcionales son autorizaciones', () => {
    const textos = textosDeAceptacionDeReserva(LOCAL);
    expect(textos.reserva).toMatch(/^Acepto las condiciones de la reserva/);
    expect(textos.reserva).toContain('Agencia de Protección de Datos Personales');
    expect(textos.novedades).toMatch(/^Quiero recibir beneficios/);
  });
});

describe('beneficios y novedades', () => {
  it('un solo permiso específico: canales, contenidos, historial, plazo y retiro', () => {
    const texto = textosDeAceptacionDeReserva(LOCAL).novedades;
    for (const parte of ['correo, WhatsApp o SMS', 'cumpleaños', 'visitas y preferencias', 'nunca datos de salud', '60 meses', 'no condiciona mi reserva', 'retirarlo']) expect(texto).toContain(parte);
    expect(texto).not.toContain('locales de');
    expect(textosDeAceptacionDeReserva(LOCAL, { grupo: true, red: 'Grupo Costa' }).novedades).toContain('y de los locales de Grupo Costa');
  });
  it('la medición informa remarketing y audiencias', () => {
    expect(TEXTO_MEDICION).toContain('audiencias');
    expect(documentoATexto(documentoDeEspartanos('medicion'))).toContain('audiencias');
  });
});

describe('datos sensibles', () => {
  const campos = [{ id: 'alergia', sensible: true }, { id: 'mesa' }];
  it('se detectan en campos de visita de salud o en campos marcados, sólo si traen respuesta', () => {
    expect(traeDatosSensibles(campos, { mesa: 'ventana' }, {})).toBe(false);
    expect(traeDatosSensibles(campos, { alergia: '  ' }, { dietaryNotes: '' })).toBe(false);
    expect(traeDatosSensibles(campos, { alergia: 'maní' }, {})).toBe(true);
    expect(traeDatosSensibles(campos, {}, { dietaryNotes: 'sin gluten' })).toBe(true);
    expect(traeDatosSensibles(campos, {}, { accessibilityNeed: 'silla de ruedas' })).toBe(true);
  });
  it('las políticas explican el tratamiento de datos sensibles y la casilla es propia', () => {
    expect(documentoATexto(documentoDeEspartanos('privacidad'))).toContain('consentimiento expreso');
    expect(textosDeAceptacionDeReserva(LOCAL).sensibles).toMatch(/^Autorizo expresamente a Casa SpA/);
  });
});

describe('identidad legal para publicar', () => {
  it('pide razón social, RUT válido y correo', () => {
    expect(faltantesDeIdentidadLegal(LOCAL)).toEqual([]);
    expect(faltantesDeIdentidadLegal({ razonSocial: ' ', rut: '12.345.678-0', correo: 'no-es-correo' })).toEqual(['razón social', 'RUT válido', 'correo para consultas de privacidad']);
  });

  it('una encuesta con datos personales no se activa sin la identidad de su empresa', async () => {
    const preguntas = [{ id: 'dato-correo', type: 'text' as const, question: 'Correo', required: false, dato: 'correo' as const }];
    const vacia = { query: async () => [{ legal_name: null, tax_id: null, privacy_email: null }] };
    await expect(exigirIdentidadLegalDeEncuesta(vacia, 'c1', preguntas)).rejects.toThrow('razón social');
    // Sin datos personales, o sin empresa (encuesta de Espartanos), no se exige.
    await expect(exigirIdentidadLegalDeEncuesta(vacia, 'c1', [{ id: 'nota', type: 'rating', question: 'Nota', required: true }])).resolves.toBeUndefined();
    await expect(exigirIdentidadLegalDeEncuesta(vacia, null, preguntas)).resolves.toBeUndefined();
    const completa = { query: async () => [{ legal_name: 'Casa SpA', tax_id: '76.086.428-5', privacy_email: 'priv@casa.cl' }] };
    await expect(exigirIdentidadLegalDeEncuesta(completa, 'c1', preguntas)).resolves.toBeUndefined();
  });
});
