export declare class CreateObjectiveDto {
    ownerId?: string;
    clientId?: string;
    category: string;
    title: string;
    description?: string;
    status?: string;
    progress?: number;
    dueAt?: string;
}
declare const UpdateObjectiveDto_base: import("@nestjs/common").Type<Partial<CreateObjectiveDto>>;
export declare class UpdateObjectiveDto extends UpdateObjectiveDto_base {
}
export {};
