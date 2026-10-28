import { describe, expect, it } from 'vitest';
import { CATALOGO_DE_RUBROS, tipoDeCaptacion } from '@espartanos/shared';

/**
 * Con qué valores nace un formulario según su rubro.
 *
 * El preset se aplica una vez, al crear, y es un punto de partida: no decide quién ve qué ni qué
 * se puede hacer. Lo que estas pruebas sostienen es que el catálogo no se rompa en silencio —una
 * clave repetida, un tipo sin campos de contacto— porque un preset mal formado no falla al
 * desplegarse, falla cuando alguien crea un formulario y le sale vacío.
 */
describe('catálogo de rubros', () => {
  it('ninguna clave de rubro se repite, y ninguna de tipo dentro de su rubro', () => {
    const rubros = CATALOGO_DE_RUBROS.map((rubro) => rubro.clave);
    expect(rubros).toEqual([...new Set(rubros)]);
    for (const rubro of CATALOGO_DE_RUBROS) {
      const tipos = rubro.tipos.map((tipo) => tipo.clave);
      expect(tipos, `tipos repetidos en ${rubro.clave}`).toEqual([...new Set(tipos)]);
    }
  });

  /*
   * Nombre y teléfono en todos: sin ellos no se puede atender a nadie, ni avisarle si el local
   * cierra ese día. Un preset que los olvide crea un formulario inútil que nadie revisa hasta que
   * llega la primera reserva sin forma de contactar.
   */
  it('todo tipo pide al menos nombre y teléfono, y los pide obligatorios', () => {
    for (const rubro of CATALOGO_DE_RUBROS) {
      for (const tipo of rubro.tipos) {
        const obligatorios = tipo.campos.filter((campo) => campo.obligatorio).map((campo) => campo.clave);
        expect(obligatorios, `${rubro.clave}/${tipo.clave}`).toContain('nombre');
        expect(obligatorios, `${rubro.clave}/${tipo.clave}`).toContain('telefono');
      }
    }
  });

  /*
   * Sin agenda significa que el formulario sólo recoge: no ofrece horas. Se expresa con duración y
   * capacidad en cero, que es lo que el producto ya entiende como «no hay bloques». Un tipo que
   * dijera `sin_agenda` con duración 45 ofrecería horas que nadie puede atender.
   */
  it('lo que no agenda horas no declara duración ni capacidad', () => {
    for (const rubro of CATALOGO_DE_RUBROS) {
      for (const tipo of rubro.tipos) {
        if (tipo.agenda !== 'sin_agenda') {
          expect(tipo.duracionMinutos, `${rubro.clave}/${tipo.clave}`).toBeGreaterThan(0);
          expect(tipo.capacidad, `${rubro.clave}/${tipo.clave}`).toBeGreaterThan(0);
          continue;
        }
        expect(tipo.duracionMinutos, `${rubro.clave}/${tipo.clave}`).toBe(0);
        expect(tipo.capacidad, `${rubro.clave}/${tipo.clave}`).toBe(0);
      }
    }
  });

  /*
   * Un procedimiento de salud trata datos de categoría especial, y la Ley 21.719 pide que el
   * consentimiento sea libre, informado, específico y demostrable. La casilla obligatoria es lo
   * que lo vuelve demostrable, así que no puede depender de que nadie la quite del preset.
   */
  it('el procedimiento de salud trae el consentimiento obligatorio', () => {
    const preset = tipoDeCaptacion('salud', 'procedimiento');
    expect(preset).not.toBeNull();
    const consentimiento = preset!.campos.find((campo) => campo.tipo === 'consentimiento');
    expect(consentimiento?.obligatorio).toBe(true);
  });

  it('una clave que no existe no devuelve un preset a medias', () => {
    expect(tipoDeCaptacion('gastronomico', 'no_existe')).toBeNull();
    expect(tipoDeCaptacion('no_existe', 'mesa')).toBeNull();
    expect(tipoDeCaptacion(null, null)).toBeNull();
    expect(tipoDeCaptacion('gastronomico', undefined)).toBeNull();
  });
});
