import { IntegrationStatus } from '../integration-status.enum';
export declare class UpdateIntegrationDto {
    status?: IntegrationStatus;
    config?: Record<string, unknown>;
}
