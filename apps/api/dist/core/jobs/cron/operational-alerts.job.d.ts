import { DataSource, Repository } from 'typeorm';
import { Notification } from '../../notifications/notification.entity';
import { ParameterResolver } from '../../parameters/parameter-resolver.service';
export declare class OperationalAlertsJob {
    private readonly dataSource;
    private readonly notifications;
    private readonly parameters;
    private readonly logger;
    constructor(dataSource: DataSource, notifications: Repository<Notification>, parameters: ParameterResolver);
    handle(): Promise<void>;
    private deadlineAlerts;
    private actionItemAlerts;
    private budgetAlerts;
    private cycleAlerts;
    private directors;
    private notifyOnce;
}
