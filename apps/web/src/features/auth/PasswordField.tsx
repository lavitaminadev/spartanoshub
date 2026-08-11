import { useState } from 'react';
import { PASSWORD_RULES } from './password-rules';

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  showRules?: boolean;
}

export function PasswordField({ id, label, value, onChange, autoComplete, showRules }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="form-group">
      <label htmlFor={id}>{label} <span className="required-mark">Obligatorio</span></label>
      <div className="input-group password-input-group">
        <input
          id={id}
          name={id}
          className="input"
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          minLength={8}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="password-visibility-button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>
      {showRules && (
        <ul className="password-rules" aria-label="Requisitos de contraseña">
          {PASSWORD_RULES.map((rule) => {
            const passed = rule.test(value);
            return <li key={rule.label} className={passed ? 'passed' : 'pending'}>{passed ? 'Cumple' : 'Pendiente'}: {rule.label}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
