import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UserRole } from '@vitahub/shared';
import { api } from './api';
import { useAuth } from './auth';
import { parsePreviewRole, ROLE_PREVIEW_STORAGE_KEY, RolePreviewContext, type PermissionLevel, type RolePreviewValue } from './role-preview-context';

/**
 * Interpreta lo que había guardado como cargo, o `null` si no es uno.
 *
 * `sessionStorage` lo puede escribir cualquiera desde la consola del navegador, así que lo que
 * sale de ahí es texto, no un cargo. Se comprueba contra la lista real antes de tratarlo como
 * tal: con un valor inventado, la navegación se calcularía contra un cargo que no existe y el
 * menú quedaría vacío sin explicación.
 *
 * No es un control de seguridad —la autorización la resuelve el servidor con la sesión de quien
 * mira—, es que el tipo diga la verdad sobre el dato.
 */
/**
 * Previsualización de la aplicación con los permisos de otro cargo.
 *
 * **Cambia lo que se dibuja, nunca lo que se autoriza.** La sesión sigue siendo la de quien
 * mira y cada petición se resuelve con sus propios permisos en el servidor: si la
 * previsualización mostrara una pantalla que el usuario real no alcanza, el backend
 * responderá 403 igual. Eso es deliberado — un selector de la interfaz que concediera acceso
 * sería una vía de escalada, y el guard de permisos dejó de fallar abierto justamente para
 * que nada lo pueda puentear.
 *
 * Existe para verificar la matriz de cargos sin crear una cuenta por cada uno, que es como se
 * comprueban de verdad los permisos antes de dar de alta a alguien.
 */
export function RolePreviewProvider({ children }: { children: ReactNode }) {
  const user = useAuth((state) => state.user);
  // Solo administración: es una herramienta de verificación, y saber con exactitud qué alcanza
  // cada cargo es justo lo que le sirve a quien prepara un abuso desde dentro.
  const canPreview = user?.role === 'admin' || user?.role === 'dev';

  const [previewRole, setPreviewRoleState] = useState<UserRole | null>(() => {
    if (typeof window === 'undefined') return null;
    return parsePreviewRole(window.sessionStorage.getItem(ROLE_PREVIEW_STORAGE_KEY));
  });

  const setPreviewRole = useCallback((role: UserRole | null) => {
    setPreviewRoleState(role);
    try {
      // En `sessionStorage` y no en `localStorage`: la previsualización no debe sobrevivir al
      // cierre del navegador ni aparecer sin querer en la sesión siguiente.
      if (role) window.sessionStorage.setItem(ROLE_PREVIEW_STORAGE_KEY, role);
      else window.sessionStorage.removeItem(ROLE_PREVIEW_STORAGE_KEY);
    } catch { /* almacenamiento no disponible: la previsualización dura lo que la pestaña */ }
  }, []);

  const active = canPreview ? previewRole : null;

  const { data } = useQuery<{ role: string; permissions: Record<string, PermissionLevel> }>({
    queryKey: ['role-preview', active],
    queryFn: () => api.get(`/roles/${active}/permissions`),
    enabled: Boolean(active),
  });

  const value = useMemo<RolePreviewValue>(() => ({
    previewRole: active,
    setPreviewRole,
    effectivePermissions: active && data?.permissions ? data.permissions : user?.permissions,
    canPreview,
  }), [active, data?.permissions, user?.permissions, setPreviewRole, canPreview]);

  return <RolePreviewContext.Provider value={value}>{children}</RolePreviewContext.Provider>;
}
