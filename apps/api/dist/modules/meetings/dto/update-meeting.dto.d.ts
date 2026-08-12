import { CreateMeetingDto } from './create-meeting.dto';
import { MeetingStatus } from '../meeting-status.enum';
declare const UpdateMeetingDto_base: import("@nestjs/common").Type<Partial<CreateMeetingDto>>;
export declare class UpdateMeetingDto extends UpdateMeetingDto_base {
    status?: MeetingStatus;
}
export {};
