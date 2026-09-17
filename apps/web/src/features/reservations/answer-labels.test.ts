import { describe, expect, it } from 'vitest';
import { respuestasLegibles } from './answer-labels';
import type { FormField } from './types';

const ESQUEMA = [
  { id: 'presupuesto', type: 'text', label: '¿Cuánto piensan gastar por persona?', required: false },
] as unknown as FormField[];

/**
 * Lo que la persona respondió tiene que poder leerse aunque el formulario haya cambiado después:
 * el rótulo sale del formulario cuando existe, del catálogo del sistema cuando no, y en último
 * caso de la propia clave, escrita como frase.
 */
describe('respuestas legibles', () => {
  it('usa el enunciado del formulario cuando el campo existe', () => {
    const [dato] = respuestasLegibles({ presupuesto: '25.000' }, ESQUEMA);
    expect(dato.etiqueta).toBe('¿Cuánto piensan gastar por persona?');
  });

  it('cae en el catálogo del sistema para las preguntas de la visita', () => {
    const datos = respuestasLegibles({ dietaryNotes: 'Sin gluten', smokingPreference: 'Zona de fumadores' }, ESQUEMA);
    expect(datos.map((dato) => dato.etiqueta)).toEqual(['Restricciones alimentarias', 'Fumadores']);
  });

  /* Una clave huérfana se muestra igual: perder el dato sería peor que enseñarlo con otro nombre. */
  it('escribe como frase la clave que no tiene rótulo en ninguna parte', () => {
    const datos = respuestasLegibles({ horaDeLlegada: '20:30', presupuesto_por_persona: '25.000' }, []);
    expect(datos.map((dato) => dato.etiqueta)).toEqual(['Hora de llegada', 'Presupuesto por persona']);
  });

  it('descarta lo que quedó vacío, que no dice nada', () => {
    expect(respuestasLegibles({ notes: '', childrenCount: 2 }, [])).toHaveLength(1);
  });
});
