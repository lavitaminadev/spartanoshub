"use strict";
/**
 * @fileoverview Runtime arrays derived from the shared domain unions.
 *
 * These arrays are kept in sync with the union types via the `satisfies` operator.
 * Consumers can use them for select options, validation, or UI labels without
 * duplicating the list of allowed values.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoles = exports.UserWorkModes = exports.IntegrationStatuses = exports.IntegrationProviders = exports.ApprovalEntityTypes = exports.ApprovalStatuses = exports.BillingPeriods = exports.BillingStatuses = exports.NotificationTypes = exports.ContentItemTypes = exports.ContentItemStatuses = exports.ContentGridStatuses = exports.MeetingStatuses = exports.MeetingTypes = exports.XpPeriodStatuses = exports.XpEventTypes = exports.XpTiers = exports.UdBudgetStatuses = exports.UdMovementTypes = exports.PieceTypes = exports.PieceStatuses = exports.LeadStatuses = exports.ClientStatuses = void 0;
const lead_1 = require("../types/lead");
/** All allowed client lifecycle statuses. */
exports.ClientStatuses = ['onboarding', 'active', 'paused', 'at_risk', 'churned'];
/**
 * All allowed lead statuses.
 *
 * Re-exported from `types/lead` so there is a single catalogue. A literal list here would
 * still satisfy `readonly LeadStatus[]` while missing entries — a subset satisfies the
 * type — so the compiler would not catch a stale copy.
 */
exports.LeadStatuses = lead_1.LEAD_STATUSES;
/** All allowed piece statuses. */
exports.PieceStatuses = ['backlog', 'assigned', 'in_progress', 'internal_review', 'client_validation', 'correction', 'approved', 'delivered'];
/** All allowed piece types. */
exports.PieceTypes = ['post_simple', 'post_author', 'carousel', 'story_original', 'story_adapted', 'story_template', 'reel_cover', 'flyer_digital', 'flyer_print'];
/** All allowed UD movement types. */
exports.UdMovementTypes = ['budget_assigned', 'reservation', 'consumption', 'adjustment', 'extra', 'rollover'];
/** All allowed UD budget statuses. */
exports.UdBudgetStatuses = ['active', 'closed', 'exceeded'];
/** All allowed XP tiers. */
exports.XpTiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
/** All allowed XP event types. */
exports.XpEventTypes = ['piece_delivered', 'piece_approved', 'correction_resolved', 'streak_bonus', 'quality_bonus', 'client_praise', 'overtime', 'mentorship', 'training_completed', 'internal_recognition'];
/** All allowed XP period statuses. */
exports.XpPeriodStatuses = ['open', 'closed'];
/** All allowed meeting types. */
exports.MeetingTypes = ['strategic', 'weekly'];
/** All allowed meeting statuses. */
exports.MeetingStatuses = ['scheduled', 'completed', 'cancelled', 'rescheduled'];
/** All allowed content grid statuses. */
exports.ContentGridStatuses = ['draft', 'submitted', 'approved', 'rejected', 'published'];
/** All allowed content item statuses. */
exports.ContentItemStatuses = ['pending', 'in_production', 'completed'];
/** All allowed content item types. */
exports.ContentItemTypes = ['post', 'carousel', 'story', 'reel', 'flyer', 'video', 'other'];
/** All allowed notification types. */
exports.NotificationTypes = ['piece_assigned', 'piece_status', 'correction_requested', 'meeting_reminder', 'budget_alert', 'deadline_approaching', 'system'];
/** All allowed invoice statuses. */
exports.BillingStatuses = ['pending', 'paid', 'overdue', 'cancelled', 'refunded'];
/** All allowed billing periods. */
exports.BillingPeriods = ['monthly', 'quarterly', 'biannual', 'annual'];
/** All allowed approval statuses. */
exports.ApprovalStatuses = ['pending', 'approved', 'rejected', 'cancelled'];
/** All allowed approval entity types. */
exports.ApprovalEntityTypes = ['piece', 'content_grid', 'budget', 'invoice'];
/** All allowed integration providers. */
exports.IntegrationProviders = ['google_drive', 'whatsapp', 'slack', 'trello', 'notion', 'meta', 'hubspot', 'shopify', 'windsor', 'custom'];
/** All allowed integration statuses. */
exports.IntegrationStatuses = ['pending', 'connected', 'disconnected', 'error'];
/** All allowed user work modes. */
exports.UserWorkModes = ['presential', 'hybrid', 'remote'];
/** All allowed user roles. */
exports.UserRoles = ['admin', 'commercial_director', 'creative_director', 'operations_director', 'art_director', 'av_director', 'ai_lead', 'community_manager', 'designer', 'audiovisual', 'client'];
//# sourceMappingURL=index.js.map