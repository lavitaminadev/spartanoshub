import { MeetingType } from '../meeting-type.enum';
export declare class CreateMeetingDto {
    clientId?: string;
    title: string;
    type?: MeetingType;
    scheduledAt?: string;
    minutes?: string;
    notes?: string;
    durationMinutes?: number;
    location?: string;
    meetingLink?: string;
}
