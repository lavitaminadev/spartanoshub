import { createContext, useContext } from 'react';
import { UserRoles, type UserRole } from '@espartanos/shared';

export type PermissionLevel = 'none' | 'view' | 'edit' | 'manage';

export interface RolePreviewValue {
  previewRole: UserRole | null;
  setPreviewRole: (role: UserRole | null) => void;
  effectivePermissions: Record<string, PermissionLevel> | undefined;
  canPreview: boolean;
}

export const ROLE_PREVIEW_STORAGE_KEY = 'espartanos:role-preview';

export const RolePreviewContext = createContext<RolePreviewValue>({
  previewRole: null,
  setPreviewRole: () => {},
  effectivePermissions: undefined,
  canPreview: false,
});

export function parsePreviewRole(value: string | null): UserRole | null {
  return value && (UserRoles as readonly string[]).includes(value) ? (value as UserRole) : null;
}

export function useRolePreview(): RolePreviewValue {
  return useContext(RolePreviewContext);
}
