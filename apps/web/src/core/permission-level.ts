/**
 * @fileoverview Nivel de acceso de una persona sobre un módulo.
 *
 * Refleja los mismos cuatro valores que resuelve el backend en
 * `core/authorization/permission-level.ts`: ambos lados deben nombrar igual lo que la matriz
 * de cargos concede, o la pantalla de permisos mostraría un nivel que la API no reconoce.
 */
export type PermissionLevel = 'none' | 'view' | 'edit' | 'manage';
