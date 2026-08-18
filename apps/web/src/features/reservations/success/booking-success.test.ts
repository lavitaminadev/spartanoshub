import { describe, expect, it } from 'vitest';
import { buildBookingMessage, buildWhatsAppShareUrl } from './whatsapp-link';
import {
  DEFAULT_VENUE_TIP_KEYS, VENUE_TIP_PRESETS,
  defaultVenueTipsText, parseVenueTips,
} from './venue-tips';

describe('compartir la reserva por WhatsApp', () => {
  const reserva = {
    formName: 'Cocina Norte',
    when: '15 de septiembre, 20:30',
    referenceCode: 'RSV-4821',
    partySize: 4,
  };

  it('arma un mensaje con lo que la persona necesita conservar', () => {
    expect(buildBookingMessage(reserva)).toBe(
      'Reserva en Cocina Norte\n15 de septiembre, 20:30\n4 personas\nCódigo: RSV-4821',
    );
  });

  it('concuerda el singular cuando va una sola persona', () => {
    expect(buildBookingMessage({ ...reserva, partySize: 1 })).toContain('1 persona\n');
  });

  it('omite la cantidad cuando no se pidió', () => {
    const { partySize: _omitido, ...sinCantidad } = reserva;
    expect(buildBookingMessage(sinCantidad)).not.toMatch(/persona/);
  });

  /**
   * Sin teléfono del local, el enlace abre WhatsApp para que la persona elija destinatario:
   * normalmente se lo manda a sí misma o a quien la acompaña.
   */
  it('sin teléfono del local, deja elegir destinatario', () => {
    expect(buildWhatsAppShareUrl(reserva)).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  /** `wa.me` rechaza el `+`, los espacios y los guiones: solo acepta dígitos. */
  it('limpia el teléfono del local antes de armar la dirección', () => {
    const url = buildWhatsAppShareUrl({ ...reserva, venuePhone: '+56 9 1234 5678' });
    expect(url).toMatch(/^https:\/\/wa\.me\/56912345678\?text=/);
  });

  it('escapa el texto para que no rompa la dirección', () => {
    const url = buildWhatsAppShareUrl({ ...reserva, formName: 'Bar & Cocina #1' })!;
    expect(url).not.toContain('&text');
    expect(decodeURIComponent(url.split('text=')[1])).toContain('Bar & Cocina #1');
  });

  it('no ofrece el enlace sin código de reserva', () => {
    expect(buildWhatsAppShareUrl({ ...reserva, referenceCode: '' })).toBeUndefined();
  });
});

describe('recomendaciones del local', () => {
  it('parte con las cuatro que responden las preguntas más frecuentes', () => {
    expect(parseVenueTips(defaultVenueTipsText())).toHaveLength(4);
  });

  it('cada clave por defecto existe en el catálogo', () => {
    for (const key of DEFAULT_VENUE_TIP_KEYS) {
      expect(VENUE_TIP_PRESETS.some((preset) => preset.key === key), key).toBe(true);
    }
  });

  it('toda sugerencia explica por qué funciona', () => {
    for (const preset of VENUE_TIP_PRESETS) {
      expect(preset.why, preset.key).toBeTruthy();
      expect(preset.category, preset.key).toBeTruthy();
    }
  });

  it('no repite claves', () => {
    const claves = VENUE_TIP_PRESETS.map((preset) => preset.key);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it('descarta líneas vacías y espacios sueltos', () => {
    expect(parseVenueTips('Una\n\n   \nOtra')).toEqual(['Una', 'Otra']);
  });

  /**
   * Más de cuatro líneas dejan de leerse y compiten con el código de reserva, que es lo único
   * de esa pantalla que la persona necesita conservar.
   */
  it('recorta a cuatro aunque el local escriba más', () => {
    expect(parseVenueTips('1\n2\n3\n4\n5\n6')).toEqual(['1', '2', '3', '4']);
  });

  it('sin texto no muestra nada', () => {
    expect(parseVenueTips()).toEqual([]);
    expect(parseVenueTips('   ')).toEqual([]);
  });
});
