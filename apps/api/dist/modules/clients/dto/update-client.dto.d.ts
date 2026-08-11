import { CreateClientDto } from './create-client.dto';
import { ClientStatus } from '../client-status.enum';
declare const UpdateClientDto_base: import("@nestjs/common").Type<Partial<CreateClientDto>>;
export declare class UpdateClientDto extends UpdateClientDto_base {
    status?: ClientStatus;
    startedAt?: string;
    renewalAt?: string;
    whatsappGroup?: string;
    driveFolderId?: string;
    logoUrl?: string;
    logoPublicId?: string;
}
export {};
