import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ClientCapabilitiesDto, CreateClientDto } from '../../../src/modules/clients/dto/create-client.dto';
import { CLIENT_CAPABILITY_KEYS } from '../../../src/modules/clients/client-capabilities';

/**
 * El formulario de la cuenta debe aceptar todas las capacidades que el catálogo define.
 *
 * Declaraba tres de las cinco. Como la validación descarta lo no declarado y además lo rechaza,
 * editar una cuenta enviando `googleConversions` o `budgetVisibility` fallaba entera con un
 * mensaje que señalaba el campo sin explicar que el hueco estaba en el formulario.
 *
 * La prueba compara contra `CLIENT_CAPABILITY_KEYS` en vez de repetir la lista: agregar una
 * capacidad al catálogo y olvidar el DTO vuelve a fallar acá, que es donde se nota antes de que
 * alguien intente guardar.
 */
describe('ClientCapabilitiesDto', () => {
  it('declara exactamente las capacidades del catálogo', () => {
    const todas = Object.fromEntries(CLIENT_CAPABILITY_KEYS.map((key) => [key, true]));
    const dto = plainToInstance(ClientCapabilitiesDto, todas, { excludeExtraneousValues: false });

    expect(Object.keys(dto as object).sort()).toEqual([...CLIENT_CAPABILITY_KEYS].sort());
  });

  it('acepta una cuenta con todas las capacidades encendidas', () => {
    const dto = plainToInstance(CreateClientDto, {
      name: 'Cuenta de prueba',
      capabilities: Object.fromEntries(CLIENT_CAPABILITY_KEYS.map((key) => [key, true])),
    });

    const errores = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(errores.map((e) => e.property), JSON.stringify(errores)).toEqual([]);
  });

  it('sigue rechazando una capacidad que no existe', () => {
    // La apertura es sobre el catálogo, no sobre cualquier clave: un nombre mal escrito tiene
    // que seguir avisando en vez de guardarse como una capacidad inventada.
    const dto = plainToInstance(CreateClientDto, {
      name: 'Cuenta de prueba',
      capabilities: { inventada: true },
    });

    const errores = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(errores.length).toBeGreaterThan(0);
  });
});
