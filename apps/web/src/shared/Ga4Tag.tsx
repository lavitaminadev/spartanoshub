import { useEffect } from 'react';

interface Ga4TagProps {
  measurementId?: string | null;
  enabled?: boolean;
}

/**
 * Inyecta Google Analytics 4 (gtag.js) en la página pública de reservas.
 *
 * Sigue el mismo patrón que MetaPixel: carga el script una sola vez y
 * mantiene un registro de las propiedades ya inicializadas para soportar
 * varios formularios en la misma sesión sin duplicar configuraciones.
 */
export function Ga4Tag({ measurementId, enabled = false }: Ga4TagProps) {
  useEffect(() => {
    // Sin permiso: si Google ya estaba cargado (se retiró en esta visita), se le avisa y no mide más.
    if (!enabled) {
      window.gtag?.('consent', 'update', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      return;
    }
    if (!measurementId) return;

    if (!window.dataLayer) window.dataLayer = [];
    if (!window.gtag) {
      window.gtag = function gtag(...args: unknown[]) {
        window.dataLayer!.push(args);
      };
      // Modo de consentimiento: todo negado por defecto y concedido recién por la aceptación.
      window.gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500 });
      window.gtag('js', new Date());
    }
    window.gtag('consent', 'update', { ad_storage: 'granted', analytics_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });

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
  }, [measurementId, enabled]);

  return null;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __espartanosGa4Properties?: Set<string>;
  }
}
