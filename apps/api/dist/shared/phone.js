"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
exports.normalizePhoneDigits = normalizePhoneDigits;
const MAX_DIGITS = 15;
function defaultCountryPrefix() {
    const configured = process.env.DEFAULT_PHONE_COUNTRY_PREFIX ?? process.env.META_PHONE_DEFAULT_COUNTRY_CODE;
    return configured?.replace(/\D/g, '') || '56';
}
function normalizePhone(value) {
    if (!value)
        return undefined;
    const hadPlus = value.trim().startsWith('+');
    const digits = value.replace(/\D/g, '').replace(/^0+/, '');
    if (!digits)
        return undefined;
    if (hadPlus)
        return `+${digits.slice(0, MAX_DIGITS)}`;
    const prefix = defaultCountryPrefix();
    const alreadyInternational = digits.startsWith(prefix) && digits.length > 9;
    const withPrefix = alreadyInternational ? digits : `${prefix}${digits}`;
    return `+${withPrefix.slice(0, MAX_DIGITS)}`;
}
function normalizePhoneDigits(value) {
    return normalizePhone(value)?.slice(1);
}
//# sourceMappingURL=phone.js.map