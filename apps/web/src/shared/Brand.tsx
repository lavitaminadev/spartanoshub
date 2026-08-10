import type { JSX } from 'react';
import { BRAND } from '../core/brand';

interface BrandAssetProps {
  className?: string;
  decorative?: boolean;
}

/**
 * Marca gráfica: el casco.
 *
 * `decorative` deja la imagen fuera del árbol de accesibilidad. Se usa cuando el nombre ya
 * aparece escrito al lado, para que un lector de pantalla no lo anuncie dos veces.
 */
export function BrandMark({ className = '', decorative = false }: BrandAssetProps): JSX.Element {
  return (
    <span className={`brand-mark ${className}`.trim()}>
      <img
        src={BRAND.mark}
        width="512"
        height="512"
        alt={decorative ? '' : BRAND.name}
        aria-hidden={decorative || undefined}
      />
    </span>
  );
}

export function BrandLockup({ className = '', decorative = false }: BrandAssetProps): JSX.Element {
  return (
    <img
      className={`brand-lockup ${className}`.trim()}
      src={BRAND.lockup}
      width="46"
      height="46"
      alt={decorative ? '' : BRAND.name}
      aria-hidden={decorative || undefined}
    />
  );
}
