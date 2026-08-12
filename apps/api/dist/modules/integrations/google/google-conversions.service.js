"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GoogleConversionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleConversionsService = void 0;
exports.normalizePhoneForGoogle = normalizePhoneForGoogle;
exports.formatConversionDateTime = formatConversionDateTime;
exports.buildUserIdentifiers = buildUserIdentifiers;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const geo_inference_1 = require("../../../shared/geo-inference");
const phone_1 = require("../../../shared/phone");
function hashIdentifier(value) {
    return (0, node_crypto_1.createHash)('sha256').update(value.trim().toLowerCase()).digest('hex');
}
function normalizePhoneForGoogle(phone) {
    return (0, phone_1.normalizePhone)(phone) ?? '';
}
function formatConversionDateTime(date, timezone) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value ?? '00';
    const stamp = `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
    const asUtc = Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')), Number(get('hour')), Number(get('minute')), Number(get('second')));
    const offsetMinutes = Math.round((asUtc - date.getTime()) / 60000);
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMinutes);
    const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
    return `${stamp}${offset}`;
}
function buildUserIdentifiers(userData) {
    const identifiers = [];
    if (userData.email)
        identifiers.push({ hashedEmail: hashIdentifier(userData.email) });
    if (userData.phone) {
        const normalized = normalizePhoneForGoogle(userData.phone);
        if (normalized)
            identifiers.push({ hashedPhoneNumber: hashIdentifier(normalized) });
    }
    const addressInfo = {};
    if (userData.firstName)
        addressInfo.hashedFirstName = hashIdentifier(userData.firstName);
    if (userData.lastName)
        addressInfo.hashedLastName = hashIdentifier(userData.lastName);
    if (userData.country)
        addressInfo.countryCode = (0, geo_inference_1.normalizeGeoValue)(userData.country).toUpperCase();
    if (userData.region)
        addressInfo.state = userData.region;
    if (userData.city)
        addressInfo.city = userData.city;
    if (Object.keys(addressInfo).length > 0)
        identifiers.push({ addressInfo });
    return identifiers;
}
let GoogleConversionsService = GoogleConversionsService_1 = class GoogleConversionsService {
    constructor() {
        this.logger = new common_1.Logger(GoogleConversionsService_1.name);
    }
    adsApiVersion() {
        const version = process.env.GOOGLE_ADS_API_VERSION?.trim() || 'v24';
        return /^v\d+$/.test(version) ? version : 'v24';
    }
    adsHeaders() {
        const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
        if (!developerToken)
            throw new common_1.BadRequestException('GOOGLE_DEVELOPER_TOKEN is required');
        return {
            'developer-token': developerToken,
            ...(process.env.GOOGLE_LOGIN_CUSTOMER_ID ? { 'login-customer-id': process.env.GOOGLE_LOGIN_CUSTOMER_ID } : {}),
        };
    }
    buildPayload(conversion) {
        const userIdentifiers = buildUserIdentifiers(conversion.userData);
        const clickIdentifier = conversion.gclid
            ? { gclid: conversion.gclid }
            : conversion.gbraid
                ? { gbraid: conversion.gbraid }
                : conversion.wbraid
                    ? { wbraid: conversion.wbraid }
                    : undefined;
        if (!clickIdentifier && userIdentifiers.length === 0) {
            throw new common_1.BadRequestException('Se requiere un identificador de clic o al menos un identificador de usuario');
        }
        return {
            conversionAction: conversion.conversionAction,
            conversionDateTime: formatConversionDateTime(conversion.conversionDateTime, conversion.timezone),
            ...(clickIdentifier ?? {}),
            ...(conversion.orderId ? { orderId: conversion.orderId } : {}),
            ...(conversion.conversionValue !== undefined ? { conversionValue: conversion.conversionValue } : {}),
            ...(conversion.currencyCode ? { currencyCode: conversion.currencyCode } : {}),
            ...(userIdentifiers.length > 0 ? { userIdentifiers } : {}),
        };
    }
    async uploadClickConversions(customerId, accessToken, conversions) {
        if (conversions.length === 0)
            return { results: [] };
        const url = `https://googleads.googleapis.com/${this.adsApiVersion()}/customers/${customerId}:uploadClickConversions`;
        const body = {
            conversions: conversions.map((conversion) => this.buildPayload(conversion)),
            partialFailure: true,
        };
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                authorization: `Bearer ${accessToken}`,
                'content-type': 'application/json',
                ...this.adsHeaders(),
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(30000),
        });
        const data = await response.json();
        if (!response.ok) {
            const message = data?.error?.message ?? `Google Ads rechazó la subida (${response.status})`;
            this.logger.error(`Google Ads conversion upload failed: ${message}`);
            throw new common_1.BadRequestException(message);
        }
        if (data?.partialFailureError) {
            this.logger.warn(`Google Ads partial failure: ${data.partialFailureError.message ?? 'sin detalle'}`);
        }
        return { results: data?.results ?? [], partialFailureError: data?.partialFailureError };
    }
};
exports.GoogleConversionsService = GoogleConversionsService;
exports.GoogleConversionsService = GoogleConversionsService = GoogleConversionsService_1 = __decorate([
    (0, common_1.Injectable)()
], GoogleConversionsService);
