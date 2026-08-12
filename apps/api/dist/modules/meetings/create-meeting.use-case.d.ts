import { Repository } from 'typeorm';
import { Meeting } from './meeting.entity';
import { MeetingType } from './meeting-type.enum';
export declare class CreateMeetingUseCase {
    private repo;
    constructor(repo: Repository<Meeting>);
    execute(data: {
        organizationId: string;
        title: string;
        type: MeetingType;
        scheduledAt: Date;
        durationMinutes?: number;
        createdBy: string;
        clientId?: string;
        location?: string;
        meetingLink?: string;
        minutes?: string;
    }): Promise<Meeting>;
}
