import { Contract } from './contract.entity';
export declare class ContractService {
    id: string;
    contractId: string;
    contract: Contract;
    serviceId?: string;
    packId?: string;
    quantity: number;
    unitPrice?: number;
    createdAt: Date;
}
