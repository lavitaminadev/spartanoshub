/**
 * @fileoverview Medidor de fortaleza de contraseña con barra de color y checklist de
 * requisitos. La fortaleza se deriva de cuántos requisitos cumple la contraseña actual;
 * no valida nada por su cuenta — el formulario que la usa decide si bloquea el envío.
 */

import { useMemo, type JSX } from 'react';
import './PasswordStrengthMeter.css';

/** Un requisito evaluado sobre la contraseña actual. */
export interface PasswordRequirement {
  key: string;
  label: string;
  met: boolean;
}

/** Props del medidor. */
export interface PasswordStrengthMeterProps {
  /** Contraseña a evaluar (se evalúa en cada render, no se guarda). */
  password: string;
}

const LEVELS = [
  { label: 'Débil', variable: '--danger' },
  { label: 'Medio', variable: '--amber' },
  { label: 'Fuerte', variable: '--cyan' },
  { label: 'Muy fuerte', variable: '--success' },
] as const;

function evaluate(password: string): { requirements: PasswordRequirement[]; level: number } {
  const requirements: PasswordRequirement[] = [
    { key: 'length', label: 'Mínimo 8 caracteres', met: password.length >= 8 },
    { key: 'upper', label: 'Una letra mayúscula', met: /[A-Z]/.test(password) },
    { key: 'number', label: 'Un número', met: /[0-9]/.test(password) },
    { key: 'symbol', label: 'Un símbolo (!@#$…)', met: /[^A-Za-z0-9]/.test(password) },
  ];
  if (password.length === 0) return { requirements, level: -1 };
  const metCount = requirements.filter((requirement) => requirement.met).length;
  const level = Math.min(metCount, LEVELS.length) - 1;
  return { requirements, level: Math.max(level, 0) };
}

/**
 * Renderiza una barra de 4 segmentos (rojo → ámbar → cian → verde) y la lista de requisitos
 * cumplidos/pendientes para la contraseña recibida.
 */
export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps): JSX.Element {
  const { requirements, level } = useMemo(() => evaluate(password), [password]);
  const current = level >= 0 ? LEVELS[level] : null;

  return (
    <div className="password-strength-meter">
      <div
        className="password-strength-bar"
        role="img"
        aria-label={current ? `Fuerza de la contraseña: ${current.label}` : 'Fuerza de la contraseña: sin evaluar'}
      >
        {LEVELS.map((levelInfo, index) => (
          <span
            key={levelInfo.label}
            className={`password-strength-segment${index <= level ? ' is-filled' : ''}`}
            style={index <= level ? { background: `var(${current!.variable})` } : undefined}
          />
        ))}
      </div>
      <p className="password-strength-label" aria-live="polite" style={current ? { color: `var(${current.variable})` } : undefined}>
        {current ? current.label : 'Sin evaluar'}
      </p>
      <ul className="password-strength-requirements">
        {requirements.map((requirement) => (
          <li key={requirement.key} className={requirement.met ? 'is-met' : ''}>
            <span aria-hidden="true">{requirement.met ? '✓' : '○'}</span>
            {requirement.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
