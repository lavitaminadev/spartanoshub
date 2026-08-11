import { useEffect } from 'react';

interface Ga4TagProps {
  measurementId?: string | null;
}

/**
 * Inyecta Google Analytics 4 (gtag.js) en la página pública de reservas.
 *
 * Sigue el mismo patrón que MetaPixel: carga el script una sola vez y
 * mantiene un registro de las propiedades ya inicializadas para soportar
 * varios formularios en la misma sesión sin duplicar configuraciones.
 */
export function Ga4Tag({ measurementId }: Ga4TagProps) {
  useEffect(() => {
    if (!measurementId) return;

    if (!window.dataLayer) window.dataLayer = [];
    if (!window.gtag) {
      window.gtag = function gtag(...args: unknown[]) {
        window.dataLayer!.push(args);
      };
      window.gtag('js', new Date());
    }

    if (!document.getElementById('ga4-script')) {
      const script = document.createElement('script');
      script.id = 'ga4-script';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      document.head.appendChild(script);
    }

    window.__espartanosGa4Properties ??= new Set<string>();
    if (!window.__espartanosGa4Properties.has(measurementId)) {
      window.gtag('config', measurementId);
      window.__espartanosGa4Properties.add(measurementId);
    }
  }, [measurementId]);

  return null;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __espartanosGa4Properties?: Set<string>;
  }
}
