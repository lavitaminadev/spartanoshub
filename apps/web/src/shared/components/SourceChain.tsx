/**
 * SourceChain — Cadena de origen que muestra la trazabilidad de un trabajo.
 *
 * Reproduce el patrón visual del prototipo: Cliente → Brief → Solicitud → Sesión → Trabajo.
 * Cada eslabón muestra etiqueta + valor, unidos por flechas →.
 * Se usa en el detalle de pieza (WorkDetailPage) para mostrar de dónde viene cada trabajo.
 */

import { type JSX, memo } from 'react';

export interface SourceChainLink {
  label: string;
  value: string;
  href?: string;
}

export interface SourceChainProps {
  links: SourceChainLink[];
  ariaLabel?: string;
  className?: string;
}

export const SourceChain = memo(function SourceChain({
  links,
  ariaLabel = 'Cadena de origen',
  className = '',
}: SourceChainProps): JSX.Element | null {
  if (!links.length) return null;

  return (
    <div className={`source-chain ${className}`} aria-label={ariaLabel}>
      {links.map((link, index) => (
        <span key={index}>
          {index > 0 && <i aria-hidden="true">→</i>}
          <span>
            <small>{link.label}</small>
            {link.href ? (
              <a href={link.href} className="source-chain-link">
                <b>{link.value}</b>
              </a>
            ) : (
              <b>{link.value}</b>
            )}
          </span>
        </span>
      ))}
    </div>
  );
});
