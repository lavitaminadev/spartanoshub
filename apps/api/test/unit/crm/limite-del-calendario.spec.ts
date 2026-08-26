// Los decoradores de `class-transformer` leen metadatos de tipo; sin esto, `@Type` falla al
// cargarse y la suite ni siquiera llega a ejecutar sus pruebas.
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListInteractionsDto } from '../../../src/modules/crm/interactions/dto/list-interactions.dto';

/**
 * Cuánto puede pedir el calendario de una vez.
 *
 * Existe porque ya falló: el calendario pasó a pedir el período completo que dibuja —hasta seis
 * semanas— y el tope general de cien devolvía 400. La pantalla no mostraba un mes incompleto:
 * no cargaba en absoluto, con «limit must not be greater than 100» encima.
 *
 * La prueba fija el contrato en los dos extremos. Sin el de arriba, alguien puede volver a bajar
 * el tope y romper la pantalla; sin el de abajo, el límite deja de existir y una petición puede
 * arrastrar la tabla entera.
 */
function validar(query: Record<string, unknown>) {
  const dto = plainToInstance(ListInteractionsDto, query);
  return validateSync(dto);
}

describe('límite del listado de actividades', () => {
  it('acepta los 500 que pide el calendario para un mes completo', () => {
    expect(validar({ limit: 500 })).toHaveLength(0);
  });

  it('sigue aceptando el tope general, que usan los demás listados', () => {
    expect(validar({ limit: 100 })).toHaveLength(0);
  });

  it('rechaza más de 500: el rango de fechas acota, pero el tope tiene que existir', () => {
    const errores = validar({ limit: 501 });
    expect(errores).not.toHaveLength(0);
    expect(errores[0].property).toBe('limit');
  });

  it('rechaza cero y negativos', () => {
    expect(validar({ limit: 0 })).not.toHaveLength(0);
    expect(validar({ limit: -1 })).not.toHaveLength(0);
  });

  it('el rango de fechas viaja como fecha válida o no viaja', () => {
    expect(validar({ from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T23:59:59.999Z' })).toHaveLength(0);
    expect(validar({ from: 'el lunes' })).not.toHaveLength(0);
  });
});
