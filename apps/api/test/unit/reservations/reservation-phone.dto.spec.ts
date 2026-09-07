import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { PublicReservationDto } from '../../../src/modules/reservations/dto/reservation.dto';

function publicBooking(guestPhone: string) {
  return plainToInstance(PublicReservationDto, {
    startsAt: '2026-10-10T21:00:00.000Z',
    guestName: 'Camila Rojas',
    guestPhone,
    answers: {},
    idempotencyKey: 'abcdefghijklmnopqrstuvwx',
  });
}

describe('PublicReservationDto phone validation', () => {
  it('accepts a Chilean mobile number', async () => {
    expect(await validate(publicBooking('+56 9 1234 5678'))).toHaveLength(0);
  });

  it('rejects a non-mobile or foreign number', async () => {
    const errors = await validate(publicBooking('+56 2 2345 6789'));
    expect(errors.some((error) => error.property === 'guestPhone')).toBe(true);
  });
});
