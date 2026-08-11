import type { AuthenticatedRequest } from '@shared/types/request';
import { UserRole } from '../organizations/user-role.enum';
import { CreatePodDto, SetPodClientsDto, SetPodMembersDto, UpdatePodDto } from './dto/pod.dto';
import { PodsService } from './pods.service';
export declare class PodsController {
    private readonly pods;
    constructor(pods: PodsService);
    list(req: AuthenticatedRequest): Promise<{
        members: {
            id: string;
            name: string;
            role: UserRole;
            workMode: "presential" | "hybrid" | "remote" | undefined;
        }[];
        clients: {
            id: string;
            name: string;
            status: import("../clients/client-status.enum").ClientStatus;
            defaultUdBudget: number;
        }[];
        id: string;
        organizationId: string;
        name: string;
        leaderId?: string;
        status: string;
        monthlyCapacityUd: number;
        description?: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    create(dto: CreatePodDto, req: AuthenticatedRequest): Promise<import("./pod.entity").Pod>;
    update(id: string, dto: UpdatePodDto, req: AuthenticatedRequest): Promise<import("./pod.entity").Pod>;
    setMembers(id: string, dto: SetPodMembersDto, req: AuthenticatedRequest): Promise<{
        members: {
            id: string;
            name: string;
            role: UserRole;
            workMode: "presential" | "hybrid" | "remote" | undefined;
        }[];
        clients: {
            id: string;
            name: string;
            status: import("../clients/client-status.enum").ClientStatus;
            defaultUdBudget: number;
        }[];
        id: string;
        organizationId: string;
        name: string;
        leaderId?: string;
        status: string;
        monthlyCapacityUd: number;
        description?: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    setClients(id: string, dto: SetPodClientsDto, req: AuthenticatedRequest): Promise<{
        members: {
            id: string;
            name: string;
            role: UserRole;
            workMode: "presential" | "hybrid" | "remote" | undefined;
        }[];
        clients: {
            id: string;
            name: string;
            status: import("../clients/client-status.enum").ClientStatus;
            defaultUdBudget: number;
        }[];
        id: string;
        organizationId: string;
        name: string;
        leaderId?: string;
        status: string;
        monthlyCapacityUd: number;
        description?: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    remove(id: string, req: AuthenticatedRequest): Promise<{
        archived: true;
    }>;
}
