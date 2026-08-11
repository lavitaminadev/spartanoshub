import { ReservationsService } from './reservations.service';
import { CreateManualReservationDto } from '../dto/reservation.dto';
export declare const MAX_IMPORT_ROWS = 500;
export interface ParsedImportRow {
    rowNumber: number;
    data: Partial<CreateManualReservationDto>;
    errors: string[];
}
export interface ImportPreview {
    totalRows: number;
    validRows: number;
    rows: ParsedImportRow[];
}
export interface ImportResult {
    imported: number;
    failed: number;
    errors: Array<{
        rowNumber: number;
        message: string;
    }>;
}
export declare class ReservationsBulkImportService {
    private readonly reservations;
    private readonly logger;
    constructor(reservations: ReservationsService);
    parse(csvContent: string, formId: string): ImportPreview;
    private validateRow;
    import(organizationId: string, userId: string, csvContent: string, formId: string, options?: {
        skipAvailability?: boolean;
        clientId?: string;
        clientIds?: string[];
    }): Promise<ImportResult>;
}
