export declare class PaginationDto {
    limit?: number;
    offset?: number;
}
export declare class PaginatedResult<T> {
    data: T[];
    total: number;
    limit: number;
    offset: number;
    constructor(data: T[], total: number, limit: number, offset: number);
}
