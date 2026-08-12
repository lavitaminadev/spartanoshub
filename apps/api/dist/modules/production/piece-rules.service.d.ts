import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';
export declare class PieceRulesService {
    private readonly parameters?;
    private readonly defaultMaxCorrections;
    constructor(parameters?: ParameterResolver | undefined);
    canRequestCorrection(currentCount: number, isDesignerError: boolean, organizationId?: string): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    shouldGenerateInvoice(clientCorrectionCount: number, organizationId?: string): Promise<boolean>;
    private resolveMaxCorrections;
}
