export declare const PERMISSION_LEVELS: readonly ["none", "view", "edit", "manage"];
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];
export declare function satisfies(granted: PermissionLevel, required: PermissionLevel): boolean;
export declare function isPermissionLevel(value: string): value is PermissionLevel;
