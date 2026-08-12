import { ParameterDefinition } from './parameter-definition.entity';
export declare class ParameterValue {
    id: string;
    definitionId: string;
    definition: ParameterDefinition;
    scopeType: string;
    scopeId: string;
    valueJson: {
        value: any;
    };
    version: number;
    validFrom: Date;
    validTo?: Date;
    createdAt: Date;
    updatedAt: Date;
}
