import { OrganizationFeatures } from './organization-features';
export declare class Organization {
    id: string;
    name: string;
    code: string;
    logoUrl?: string;
    welcomeMessage?: string;
    currency: string;
    isActive: boolean;
    features: OrganizationFeatures;
    createdAt: Date;
    updatedAt: Date;
    normalizeFeatures(): void;
}
