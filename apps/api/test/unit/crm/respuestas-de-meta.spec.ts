import { describe, expect, it } from 'vitest';
import { repartirRespuestasDeMeta, type CampoConPreguntas } from '../../../src/modules/crm/fields/respuestas-de-meta';

const campo = (parcial: Partial<CampoConPreguntas>): CampoConPreguntas => ({
  id: 'f', entity: 'lead', key: 'presupuesto_mensual', label: 'Presupuesto mensual', type: 'number',
  options: null, required: false, position: 0, archivedAt: null, ...parcial,
});

describe('repartirRespuestasDeMeta', () => {
  it('lleva la respuesta al campo que declaró esa pregunta', () => {
    const definiciones = [campo({ metaQuestions: ['¿Cuál es tu presupuesto?'] })];
    const { camposPropios, sinCampo } = repartirRespuestasDeMeta(definiciones, [{ nombre: 'cual_es_tu_presupuesto', valor: '$500.000' }]);
    expect(camposPropios).toEqual({ presupuesto_mensual: 500000 });
    expect(sinCampo).toHaveLength(0);
  });

  it('la clave del campo ya vale como equivalencia, sin configurar nada', () => {
    const { camposPropios } = repartirRespuestasDeMeta([campo({})], [{ nombre: 'Presupuesto Mensual', valor: '250000' }]);
    expect(camposPropios).toEqual({ presupuesto_mensual: 250000 });
  });

  it('lo que ningún campo reclama se queda para las notas', () => {
    const { camposPropios, sinCampo } = repartirRespuestasDeMeta([campo({})], [{ nombre: 'cuando_empezar', valor: 'Este mes' }]);
    expect(camposPropios).toEqual({});
    expect(sinCampo).toEqual([{ nombre: 'cuando_empezar', valor: 'Este mes' }]);
  });

  it('un valor que no encaja con el tipo no se guarda: iría a romper los filtros', () => {
    const { camposPropios, sinCampo } = repartirRespuestasDeMeta([campo({})], [{ nombre: 'presupuesto_mensual', valor: 'lo que sea necesario' }]);
    expect(camposPropios).toEqual({});
    expect(sinCampo).toHaveLength(1);
  });

  it('una opción se reconoce aunque venga con otra acentuación', () => {
    const definiciones = [campo({ key: 'canal', type: 'select', options: ['WhatsApp', 'Correo'], metaQuestions: ['contacto preferido'] })];
    const { camposPropios } = repartirRespuestasDeMeta(definiciones, [{ nombre: 'Contacto preferido', valor: 'whatsapp' }]);
    expect(camposPropios).toEqual({ canal: 'WhatsApp' });
  });

  it('varias opciones llegan separadas por coma y se quedan sólo las que existen', () => {
    const definiciones = [campo({ key: 'servicios', type: 'multi_select', options: ['Meta Ads', 'Branding'], metaQuestions: ['que te interesa'] })];
    const { camposPropios } = repartirRespuestasDeMeta(definiciones, [{ nombre: 'Qué te interesa', valor: 'Meta Ads, Otra cosa, Branding' }]);
    expect(camposPropios).toEqual({ servicios: ['Meta Ads', 'Branding'] });
  });

  it('un campo archivado no recibe nada', () => {
    const definiciones = [campo({ archivedAt: '2026-01-01T00:00:00Z', metaQuestions: ['presupuesto'] })];
    const { camposPropios, sinCampo } = repartirRespuestasDeMeta(definiciones, [{ nombre: 'presupuesto', valor: '100000' }]);
    expect(camposPropios).toEqual({});
    expect(sinCampo).toHaveLength(1);
  });
});
