import { Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
import { CreatePodDto, UpdatePodDto } from './dto/pod.dto';
import { PodMember } from './pod-member.entity';
import { Pod } from './pod.entity';
export declare class PodsService {
    private readonly pods;
    private readonly members;
    private readonly users;
    private readonly clients;
    private readonly accountAccess;
    constructor(pods: Repository<Pod>, members: Repository<PodMember>, users: Repository<User>, clients: Repository<Client>, accountAccess: AccountAccessService);
    list(organizationId: string): Promise<{
        members: {
            id: string;
            name: string;
            role: import("../organizations/user-role.enum").UserRole;
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
    create(organizationId: string, dto: CreatePodDto): Promise<Pod>;
    update(id: string, organizationId: string, dto: UpdatePodDto): Promise<Pod>;
    setMembers(id: string, organizationId: string, userIds: string[]): Promise<{
        members: {
            id: string;
            name: string;
            role: import("../organizations/user-role.enum").UserRole;
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
    setClients(id: string, organizationId: string, clientIds: string[]): Promise<{
        members: {
            id: string;
            name: string;
            role: import("../organizations/user-role.enum").UserRole;
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
    remove(id: string, organizationId: string): Promise<{
        archived: true;
    }>;
    private find;
    private validateLeader;
}
