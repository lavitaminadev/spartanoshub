import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';
import { GoogleOAuthService } from './google-oauth.service';
interface CalendarEventInput {
    summary: string;
    description?: string;
    start: Date;
    durationMinutes: number;
}
export declare class GoogleCalendarService {
    private readonly integrations;
    private readonly oauth;
    constructor(integrations: Repository<Integration>, oauth: GoogleOAuthService);
    createEvent(organizationId: string, event: CalendarEventInput): Promise<{
        externalId: string | undefined;
        calendarUrl: string | undefined;
        meetingLink: string | undefined;
    }>;
    private refreshIfExpiring;
    private revealAccessToken;
    private sendEvent;
}
export {};
