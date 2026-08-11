export const PASSWORD_RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: '8 caracteres como mínimo', test: (value) => value.length >= 8 },
  { label: 'Una letra mayúscula', test: (value) => /[A-Z]/.test(value) },
  { label: 'Una letra minúscula', test: (value) => /[a-z]/.test(value) },
  { label: 'Un número', test: (value) => /\d/.test(value) },
];

export function passwordRulesPassed(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}
