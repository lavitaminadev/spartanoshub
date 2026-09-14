import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateReservationFormDto } from '../../../src/modules/reservations/dto/reservation.dto';

/*
 * Los QR impresos y los enlaces publicados llevan el nombre público de la sucursal. Si se pudiera
 * editar después de crearla, un cambio en la configuración dejaría inservibles los QR ya puestos
 * en mesas y vitrinas. Esta prueba falla si alguien lo vuelve editable sin pensar en eso.
 */
describe('enlace público de una sucursal', () => {
  it('no se puede cambiar al editar la sucursal', async () => {
    const dto = plainToInstance(UpdateReservationFormDto, { publicSlug: 'otro-nombre' });
    const errores = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errores.map((error) => error.property)).toContain('publicSlug');
  });
});
