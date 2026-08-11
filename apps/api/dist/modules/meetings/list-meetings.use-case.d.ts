import { Repository } from 'typeorm';
import { Meeting } from './meeting.entity';
export declare class ListMeetingsUseCase {
    private repo;
    constructor(repo: Repository<Meeting>);
    execute(organizationId: string, type?: string, clientId?: string, clientIds?: string[]): Promise<Meeting[]>;
}
