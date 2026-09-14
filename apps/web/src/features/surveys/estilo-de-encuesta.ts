import type { CSSProperties } from 'react';
import type { Survey } from '@espartanos/shared';
import { optimizedUrl } from '../../shared/imagen-optimizada';

type Diseno = NonNullable<Survey['designConfig']>;

/** Fondo de la página de una encuesta según su modo: color, degradado de dos colores o imagen. */
export function fondoDeEncuesta(design: Diseno): string {
  if (design.backgroundMode === 'gradient') {
    if (design.gradientFrom && design.gradientTo) {
      return `linear-gradient(${Number(design.gradientAngle ?? 135)}deg, ${design.gradientFrom} 0%, ${design.gradientTo} 100%)`;
    }
    return design.backgroundGradient || design.backgroundColor || '#f6f4f5';
  }
  if (design.backgroundMode === 'image' && design.backgroundImage) {
    const velo = Number(design.backgroundOpacity ?? 88) / 100;
    return `linear-gradient(rgba(255,255,255,${velo}), rgba(255,255,255,${velo})), url("${optimizedUrl(design.backgroundImage, 1920)}") center/cover`;
  }
  return design.backgroundColor || '#f6f4f5';
}

/**
 * Estilo de la página pública de una encuesta.
 *
 * Lo usan la página real y la vista previa del editor: así lo que se ve al diseñar es lo que ve
 * quien responde.
 */
export function estiloDeEncuesta(design: Diseno = {}): CSSProperties {
  return {
    '--survey-primary': design.primaryColor || '#0fb9b1',
    '--survey-accent': design.accentColor || '#ec0b61',
    '--survey-text': design.textColor || '#151317',
    '--survey-field-radius': `${Number(design.fieldRadius ?? 12)}px`,
    background: fondoDeEncuesta(design),
    color: design.textColor || '#151317',
    fontFamily: design.fontFamily || 'system-ui',
  } as CSSProperties;
}
