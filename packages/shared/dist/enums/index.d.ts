/**
 * @fileoverview Runtime arrays derived from the shared domain unions.
 *
 * These arrays are kept in sync with the union types via the `satisfies` operator.
 * Consumers can use them for select options, validation, or UI labels without
 * duplicating the list of allowed values.
 */
/** All allowed client lifecycle statuses. */
export declare const ClientStatuses: readonly ["onboarding", "active", "paused", "at_risk", "churned"];
/**
 * All allowed lead statuses.
 *
 * Re-exported from `types/lead` so there is a single catalogue. A literal list here would
 * still satisfy `readonly LeadStatus[]` while missing entries — a subset satisfies the
 * type — so the compiler would not catch a stale copy.
 */
export declare const LeadStatuses: readonly ["new", "contacted", "meeting_scheduled", "quote_sent", "negotiation", "reserved", "attended", "no_show", "won", "lost"];
/** All allowed piece statuses. */
export declare const PieceStatuses: readonly ["backlog", "assigned", "in_progress", "internal_review", "client_validation", "correction", "approved", "delivered"];
/** All allowed piece types. */
export declare const PieceTypes: readonly ["post_simple", "post_author", "carousel", "story_original", "story_adapted", "story_template", "reel_cover", "flyer_digital", "flyer_print"];
/** All allowed UD movement types. */
export declare const UdMovementTypes: readonly ["budget_assigned", "reservation", "consumption", "adjustment", "extra", "rollover"];
/** All allowed UD budget statuses. */
export declare const UdBudgetStatuses: readonly ["active", "closed", "exceeded"];
/** All allowed XP tiers. */
export declare const XpTiers: readonly ["bronze", "silver", "gold", "platinum", "diamond"];
/** All allowed XP event types. */
export declare const XpEventTypes: readonly ["piece_delivered", "piece_approved", "correction_resolved", "streak_bonus", "quality_bonus", "client_praise", "overtime", "mentorship", "training_completed", "internal_recognition"];
/** All allowed XP period statuses. */
export declare const XpPeriodStatuses: readonly ["open", "closed"];
/** All allowed meeting types. */
export declare const MeetingTypes: readonly ["strategic", "weekly"];
/** All allowed meeting statuses. */
export declare const MeetingStatuses: readonly ["scheduled", "completed", "cancelled", "rescheduled"];
/** All allowed content grid statuses. */
export declare const ContentGridStatuses: readonly ["draft", "submitted", "approved", "rejected", "published"];
/** All allowed content item statuses. */
export declare const ContentItemStatuses: readonly ["pending", "in_production", "completed"];
/** All allowed content item types. */
export declare const ContentItemTypes: readonly ["post", "carousel", "story", "reel", "flyer", "video", "other"];
/** All allowed notification types. */
export declare const NotificationTypes: readonly ["piece_assigned", "piece_status", "correction_requested", "meeting_reminder", "budget_alert", "deadline_approaching", "system"];
/** All allowed invoice statuses. */
export declare const BillingStatuses: readonly ["pending", "paid", "overdue", "cancelled", "refunded"];
/** All allowed billing periods. */
export declare const BillingPeriods: readonly ["monthly", "quarterly", "biannual", "annual"];
/** All allowed approval statuses. */
export declare const ApprovalStatuses: readonly ["pending", "approved", "rejected", "cancelled"];
/** All allowed approval entity types. */
export declare const ApprovalEntityTypes: readonly ["piece", "content_grid", "budget", "invoice"];
/** All allowed integration providers. */
export declare const IntegrationProviders: readonly ["google_drive", "whatsapp", "slack", "trello", "notion", "meta", "hubspot", "shopify", "windsor", "custom"];
/** All allowed integration statuses. */
export declare const IntegrationStatuses: readonly ["pending", "connected", "disconnected", "error"];
/** All allowed user work modes. */
export declare const UserWorkModes: readonly ["presential", "hybrid", "remote"];
/** All allowed user roles. */
export declare const UserRoles: readonly ["admin", "commercial_director", "creative_director", "operations_director", "art_director", "av_director", "ai_lead", "community_manager", "designer", "audiovisual", "client"];
//# sourceMappingURL=index.d.ts.map