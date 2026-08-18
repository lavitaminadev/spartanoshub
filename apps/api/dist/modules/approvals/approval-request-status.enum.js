"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPEN_STATUSES = exports.PendingKind = exports.ApprovalRequestStatus = void 0;
var ApprovalRequestStatus;
(function (ApprovalRequestStatus) {
    ApprovalRequestStatus["PENDING"] = "pending";
    ApprovalRequestStatus["VIEWED"] = "viewed";
    ApprovalRequestStatus["EXPIRED"] = "expired";
    ApprovalRequestStatus["APPROVED"] = "approved";
    ApprovalRequestStatus["REJECTED"] = "rejected";
    ApprovalRequestStatus["DONE"] = "done";
    ApprovalRequestStatus["CANCELLED"] = "cancelled";
})(ApprovalRequestStatus || (exports.ApprovalRequestStatus = ApprovalRequestStatus = {}));
var PendingKind;
(function (PendingKind) {
    PendingKind["APPROVAL"] = "approval";
    PendingKind["TASK"] = "task";
})(PendingKind || (exports.PendingKind = PendingKind = {}));
exports.OPEN_STATUSES = [
    ApprovalRequestStatus.PENDING,
    ApprovalRequestStatus.VIEWED,
];
