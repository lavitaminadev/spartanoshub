/**
 * @fileoverview Qué marco rodea a cada pantalla, según quién esté mirando.
 *
 * Una cuenta de empresa llega a pantallas que nacieron internas —el CRM contratado, y ahora su
 * equipo— y esas conservan su ruta canónica en vez de duplicarse bajo `/portal`. El marco, en
 * cambio, no puede conservarse: con el interno, la misma persona veía un menú en el portal y
 * otro distinto al abrir el CRM, con secciones y nombres que no eran los suyos. El menú dejaba
 * de ser una referencia estable y pasaba a depender de por dónde se hubiera entrado.
 *
 * El marco lo decide quién mira, no la ruta. Para el equipo interno no cambia nada.
 */

import { lazy, Suspense } from 'react';
import { Layout } from '../shared/Layout';
import { useAuth } from './auth';

const ClientLayout = lazy(() => import('../features/client-portal/ClientLayout').then((m) => ({ default: m.ClientLayout })));

export function AppLayout() {
  const { user } = useAuth();
  if (user?.role === 'client') {
    return <Suspense fallback={null}><ClientLayout /></Suspense>;
  }
  return <Layout />;
}
