import { Repository } from 'typeorm';
import { Reservation } from '../../../modules/reservations/domain/reservation.entity';
import { ReservationForm } from '../../../modules/reservations/domain/reservation-form.entity';
import { GoogleCalendarService } from '../../../modules/integrations/google/google-calendar.service';
import { LeadIntakeService } from '../../../modules/crm/leads/lead-intake.service';
export declare class RecoverReservationIntegrationsJob {
    private readonly reservations;
    private readonly forms;
    private readonly calendar;
    private readonly leadIntake;
    private readonly logger;
    constructor(reservations: Repository<Reservation>, forms: Repository<ReservationForm>, calendar: GoogleCalendarService, leadIntake: LeadIntakeService);
    handle(): Promise<{
        calendar: number;
        crm: number;
        failed: number;
    }>;
    private pending;
    private formOf;
}
