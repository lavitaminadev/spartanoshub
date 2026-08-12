export declare enum LeadStatus {
    NEW = "new",
    CONTACTED = "contacted",
    MEETING_SCHEDULED = "meeting_scheduled",
    QUOTE_SENT = "quote_sent",
    NEGOTIATION = "negotiation",
    RESERVED = "reserved",
    ATTENDED = "attended",
    NO_SHOW = "no_show",
    WON = "won",
    LOST = "lost"
}
export declare const STATUSES_BY_DOMAIN: Record<'commercial' | 'audience', readonly LeadStatus[]>;
export declare function isStatusInDomain(domain: string | undefined, status: LeadStatus): boolean;
