import { describe, expect, it } from 'vitest';
import { passwordRulesPassed } from './password-rules';

describe('passwordRulesPassed', () => {
  it('exige longitud, mayúscula, minúscula y número', () => {
    expect(passwordRulesPassed('Demo123456!')).toBe(true);
    expect(passwordRulesPassed('demo123456!')).toBe(false);
    expect(passwordRulesPassed('DEMO123456!')).toBe(false);
    expect(passwordRulesPassed('DemoSinNumero!')).toBe(false);
  });
});
