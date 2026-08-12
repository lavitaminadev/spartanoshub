export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

/**
 * Construye las reglas de validación a partir de la política del servidor.
 * Si no se recibe política (aún no cargó o el endpoint no responde), se usan
 * los valores por defecto que el backend ya aplica como mínimo.
 */
export function buildPasswordRules(policy?: Partial<PasswordPolicy> | null): { label: string; test: (value: string) => boolean }[] {
  const p = {
    minLength: policy?.minLength ?? 8,
    requireUppercase: policy?.requireUppercase ?? true,
    requireLowercase: policy?.requireLowercase ?? true,
    requireNumber: policy?.requireNumber ?? true,
    requireSpecial: policy?.requireSpecial ?? false,
  };
  const rules: { label: string; test: (value: string) => boolean }[] = [
    { label: `${p.minLength} caracteres como mínimo`, test: (v) => v.length >= p.minLength },
  ];
  if (p.requireUppercase) rules.push({ label: 'Una letra mayúscula', test: (v) => /[A-Z]/.test(v) });
  if (p.requireLowercase) rules.push({ label: 'Una letra minúscula', test: (v) => /[a-z]/.test(v) });
  if (p.requireNumber) rules.push({ label: 'Un número', test: (v) => /\d/.test(v) });
  if (p.requireSpecial) rules.push({ label: 'Un carácter especial (!@#$%...)', test: (v) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(v) });
  return rules;
}

/** Reglas por defecto (mínimo del backend). Se usan mientras no se carga la política del servidor. */
export const DEFAULT_RULES = buildPasswordRules();

export function passwordRulesPassed(value: string, policy?: Partial<PasswordPolicy> | null): boolean {
  return buildPasswordRules(policy).every((rule) => rule.test(value));
}
