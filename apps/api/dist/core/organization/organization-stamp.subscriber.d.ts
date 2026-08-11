import { EntitySubscriberInterface, InsertEvent } from 'typeorm';
export declare class OrganizationStampSubscriber implements EntitySubscriberInterface {
    beforeInsert(event: InsertEvent<Record<string, unknown>>): void;
}
