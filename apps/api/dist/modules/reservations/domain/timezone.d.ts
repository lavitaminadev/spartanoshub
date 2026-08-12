export interface ZonedParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    weekday: number;
}
export declare function assertTimeZone(timeZone: string): void;
export declare function zonedParts(date: Date, timeZone: string): ZonedParts;
export declare function localToUtc(date: string, time: string, timeZone: string): Date;
export declare function tryLocalToUtc(date: string, time: string, timeZone: string): Date | null;
export declare function startOfLocalDayUtc(date: string, timeZone: string): Date;
export declare function addPlainDays(value: string, days: number): string;
export declare function plainDateParts(value: string): {
    year: number;
    month: number;
    day: number;
    weekday: number;
};
