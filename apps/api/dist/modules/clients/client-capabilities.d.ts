export declare const CLIENT_CAPABILITY_KEYS: readonly ["reservations", "crm", "metaConversions", "googleConversions"];
export type ClientCapabilityKey = (typeof CLIENT_CAPABILITY_KEYS)[number];
export type ClientCapabilities = Record<ClientCapabilityKey, boolean>;
export declare const DEFAULT_CLIENT_CAPABILITIES: ClientCapabilities;
export declare function normalizeClientCapabilities(value?: Partial<ClientCapabilities> | null): ClientCapabilities;
