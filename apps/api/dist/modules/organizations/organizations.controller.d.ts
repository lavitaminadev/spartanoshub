import { Repository } from 'typeorm';
import { CreateOrganizationUseCase } from './create-organization.use-case';
import { ListOrganizationsUseCase } from './list-organizations.use-case';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateOrganizationFeaturesDto } from './dto/update-organization-features.dto';
import { Organization } from './organization.entity';
import { FeatureGuard } from '../../core/authorization/feature.guard';
import { AuditService } from '../../core/audit/audit.service';
import type { AuthenticatedRequest } from '../../shared/types/request';
export declare class OrganizationsController {
    private readonly createOrg;
    private readonly listOrgs;
    private readonly organizations;
    private readonly featureGuard;
    private readonly audit;
    constructor(createOrg: CreateOrganizationUseCase, listOrgs: ListOrganizationsUseCase, organizations: Repository<Organization>, featureGuard: FeatureGuard, audit: AuditService);
    create(dto: CreateOrganizationDto): Promise<Organization>;
    list(req: AuthenticatedRequest): Promise<Organization[]>;
    updateProfile(req: AuthenticatedRequest, dto: UpdateOrganizationDto): Promise<Organization | null>;
    features(req: AuthenticatedRequest): Promise<{
        features: import("./organization-features").OrganizationFeatures;
    }>;
    updateFeatures(req: AuthenticatedRequest, dto: UpdateOrganizationFeaturesDto): Promise<{
        features: import("./organization-features").OrganizationFeatures;
    }>;
}
