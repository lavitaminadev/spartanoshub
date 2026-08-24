import { describe, expect, it } from 'vitest';
import { canEditCrm } from './crm-scope';

describe('escritura efectiva del CRM', () => {
  it.each([
    ['none', false],
    ['view', false],
    ['edit', true],
    ['manage', true],
    [undefined, false],
  ] as const)('traduce el nivel %s a controles de escritura', (level, expected) => {
    expect(canEditCrm(level)).toBe(expected);
  });
});
