import { Organization } from '../organizations/organization.entity';
import { MeetingType } from './meeting-type.enum';
import { MeetingStatus } from './meeting-status.enum';
export declare class Meeting {
    id: string;
    organizationId: string;
    organization: Organization;
    clientId?: string;
    title: string;
    type: MeetingType;
    status: MeetingStatus;
    scheduledAt: Date;
    durationMinutes: number;
    location?: string;
    meetingLink?: string;
    createdBy: string;
    minutes?: string;
    createdAt: Date;
    updatedAt: Date;
}
