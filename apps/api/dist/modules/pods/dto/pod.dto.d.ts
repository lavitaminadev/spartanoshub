export declare class CreatePodDto {
    name: string;
    description?: string;
    leaderId?: string;
    monthlyCapacityUd: number;
}
export declare class UpdatePodDto {
    name?: string;
    description?: string;
    leaderId?: string;
    monthlyCapacityUd?: number;
    status?: string;
}
export declare class SetPodMembersDto {
    userIds: string[];
}
export declare class SetPodClientsDto {
    clientIds: string[];
}
