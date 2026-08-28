"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATUSES_BY_DOMAIN = exports.LeadStatus = void 0;
exports.isStatusInDomain = isStatusInDomain;
const shared_1 = require("@espartanos/shared");
var LeadStatus;
(function (LeadStatus) {
    LeadStatus["NEW"] = "new";
    LeadStatus["CONTACTED"] = "contacted";
    LeadStatus["MEETING_SCHEDULED"] = "meeting_scheduled";
    LeadStatus["QUOTE_SENT"] = "quote_sent";
    LeadStatus["NEGOTIATION"] = "negotiation";
    LeadStatus["RESERVED"] = "reserved";
    LeadStatus["ATTENDED"] = "attended";
    LeadStatus["NO_SHOW"] = "no_show";
    LeadStatus["WON"] = "won";
    LeadStatus["LOST"] = "lost";
})(LeadStatus || (exports.LeadStatus = LeadStatus = {}));
const _leadStatusMatchesShared = true;
void _leadStatusMatchesShared;
exports.STATUSES_BY_DOMAIN = {
    commercial: shared_1.LEAD_STATUSES_BY_DOMAIN.commercial,
    audience: shared_1.LEAD_STATUSES_BY_DOMAIN.audience,
};
function isStatusInDomain(domain, status) {
    const allowed = exports.STATUSES_BY_DOMAIN[domain];
    return Boolean(allowed?.includes(status));
}
