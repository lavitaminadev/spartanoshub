"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
exports.normalizePhoneDigits = normalizePhoneDigits;
const MAX_DIGITS = 15;
const PREFIJOS_CONOCIDOS = ['54', '51', '591', '598', '595', '57', '52', '34'];
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
    const alreadyInternational = digits.length > 9
        && (digits.startsWith(prefix) || PREFIJOS_CONOCIDOS.some((conocido) => digits.startsWith(conocido)));
    const withPrefix = alreadyInternational ? digits : `${prefix}${digits}`;
    return `+${withPrefix.slice(0, MAX_DIGITS)}`;
}
function normalizePhoneDigits(value) {
    return normalizePhone(value)?.slice(1);
}
