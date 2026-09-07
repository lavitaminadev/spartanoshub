import { describe, expect, it } from 'vitest';
import { isValidChileanMobilePhone } from './PublicReservationPage';

describe('isValidChileanMobilePhone', () => {
  it('accepts common Chilean mobile formats', () => {
    expect(isValidChileanMobilePhone('+56 9 1234 5678')).toBe(true);
    expect(isValidChileanMobilePhone('9-1234-5678')).toBe(true);
  });

  it('rejects incomplete, landline and foreign formats', () => {
    expect(isValidChileanMobilePhone('+56 2 2345 6789')).toBe(false);
    expect(isValidChileanMobilePhone('91234567')).toBe(false);
    expect(isValidChileanMobilePhone('+54 9 11 1234 5678')).toBe(false);
  });
});
