import { IntegrationProvider } from '../integration-provider.enum';
export declare class CreateIntegrationDto {
    provider: IntegrationProvider;
    name?: string;
    config?: Record<string, unknown>;
}
