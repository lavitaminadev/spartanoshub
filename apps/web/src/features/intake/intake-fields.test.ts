import { describe, expect, it } from 'vitest';
import {
  CREATIVE_FIELDS, NOT_APPLICABLE, NOT_APPLICABLE_LABEL,
  compactValues, displayFieldValue, isNotApplicable, missingCreativeFields,
} from './intake-fields';

describe('campos obligatorios de la solicitud', () => {
  it('nombra los que faltan, con la etiqueta que se ve en pantalla', () => {
    expect(missingCreativeFields('design', {})).toEqual(['Formato']);
    expect(missingCreativeFields('audiovisual', {})).toEqual(['Tipo de producción']);
    expect(missingCreativeFields('community', {})).toEqual(['Red']);
  });

  it('no reclama cuando están contestados', () => {
    expect(missingCreativeFields('design', { formato: 'post' })).toEqual([]);
  });

  it('un espacio en blanco no cuenta como respuesta', () => {
    expect(missingCreativeFields('design', { formato: '   ' })).toEqual(['Formato']);
  });

  /**
   * Un campo obligatorio no puede declararse «no aplica»: si pudiera, no sería obligatorio.
   * La prueba lo fija para que nadie marque uno por descuido y deje el formulario contradiciendo
   * su propia regla.
   */
  it('ningún campo obligatorio ofrece «No aplica»', () => {
    for (const [area, fields] of Object.entries(CREATIVE_FIELDS)) {
      const contradictorios = fields.filter((field) => field.required && field.allowNotApplicable);
      expect(contradictorios.map((f) => f.name), `en ${area}`).toEqual([]);
    }
  });
});

describe('«No aplica» como respuesta explícita', () => {
  /**
   * Es la distinción que antes no existía: `compactValues` borra los vacíos, así que un campo
   * sin contestar y uno que no corresponde se guardaban igual. Una obliga a preguntar y la otra
   * no, y quien revisaba la solicitud no podía saber cuál era cuál.
   */
  it('sobrevive a la limpieza de vacíos, a diferencia de un campo sin contestar', () => {
    const limpio = compactValues({ locacion: NOT_APPLICABLE, duracion: '', soporte: '   ' });
    expect(limpio).toEqual({ locacion: NOT_APPLICABLE });
  });

  it('se reconoce como tal', () => {
    expect(isNotApplicable(NOT_APPLICABLE)).toBe(true);
    expect(isNotApplicable('')).toBe(false);
    expect(isNotApplicable('Estudio')).toBe(false);
    expect(isNotApplicable(undefined)).toBe(false);
  });

  it('se muestra con su etiqueta y no con el marcador interno', () => {
    const locacion = CREATIVE_FIELDS.audiovisual.find((f) => f.name === 'locacion')!;
    expect(displayFieldValue(locacion, NOT_APPLICABLE)).toBe(NOT_APPLICABLE_LABEL);
    expect(displayFieldValue(locacion, 'Estudio')).toBe('Estudio');
    expect(displayFieldValue(locacion, '')).toBe('');
  });

  it('resuelve la etiqueta de las opciones de un select', () => {
    const formato = CREATIVE_FIELDS.design.find((f) => f.name === 'formato')!;
    expect(displayFieldValue(formato, 'flyer_impreso')).toBe('Flyer para impresión');
    // Un valor guardado que ya no está en la lista se muestra tal cual en vez de desaparecer:
    // el histórico no se reescribe cuando cambian las opciones.
    expect(displayFieldValue(formato, 'formato_retirado')).toBe('formato_retirado');
  });

  it('solo lo ofrecen los campos donde tiene sentido', () => {
    const conOpcion = Object.values(CREATIVE_FIELDS)
      .flat()
      .filter((field) => field.allowNotApplicable)
      .map((field) => field.name);
    expect(conOpcion).toEqual(['soporte', 'referencias', 'locacion', 'duracion']);
  });
});
