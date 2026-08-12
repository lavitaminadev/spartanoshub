import { OnboardingService } from './onboarding.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
import { ClientIdDto } from './dto/client-id.dto';
export declare class OnboardingController {
    private service;
    constructor(service: OnboardingService);
    create(dto: CreateOnboardingDto, req: AuthenticatedRequest): Promise<import("./onboarding.entity").Onboarding>;
    createStandardChecklist(dto: ClientIdDto, req: AuthenticatedRequest): Promise<import("./onboarding.entity").Onboarding[]>;
    findAll(query: PaginationDto, req: AuthenticatedRequest): Promise<{
        data: import("./onboarding.entity").Onboarding[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOne(id: string, req: AuthenticatedRequest): Promise<import("./onboarding.entity").Onboarding>;
    update(id: string, dto: UpdateOnboardingDto, req: AuthenticatedRequest): Promise<import("./onboarding.entity").Onboarding>;
    remove(id: string, req: AuthenticatedRequest): Promise<import("./onboarding.entity").Onboarding>;
}
