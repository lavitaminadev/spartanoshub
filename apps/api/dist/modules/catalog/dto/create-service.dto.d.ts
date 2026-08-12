import { ServiceCategory } from '../service-category.enum';
export declare class CreateServiceDto {
    name: string;
    category: ServiceCategory;
    description?: string;
    unitPrice?: number;
    currency?: string;
    udPerUnit?: number;
}
