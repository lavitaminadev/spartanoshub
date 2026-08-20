"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateImportRow = validateImportRow;
const MAX_LENGTH = {
    name: 255, email: 255, phone: 50, company: 255, notes: 65535,
    source: 50, sourceDetail: 255, campaignName: 180, altPhone: 50, tags: 500,
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[\d+\-\s()]+$/;
const FIELD_LABEL = {
    name: 'El nombre', email: 'El correo', phone: 'El teléfono', company: 'La empresa',
    notes: 'Las notas', source: 'El origen', sourceDetail: 'El canal de contacto',
    campaignName: 'La campaña', altPhone: 'El teléfono alternativo', tags: 'Las etiquetas',
};
function validateImportRow(raw) {
    const text = (value) => {
        const trimmed = value?.trim();
        return trimmed ? trimmed : undefined;
    };
    const row = {
        name: text(raw.name) ?? '',
        email: text(raw.email)?.toLowerCase(),
        phone: text(raw.phone),
        company: text(raw.company),
        notes: text(raw.notes),
        source: text(raw.source),
        sourceDetail: text(raw.sourceDetail),
        campaignName: text(raw.campaignName),
        altPhone: text(raw.altPhone),
        tags: text(raw.tags),
    };
    if (row.name.length < 2)
        return { ok: false, reason: 'El nombre debe tener al menos 2 caracteres' };
    for (const [field, limit] of Object.entries(MAX_LENGTH)) {
        const value = row[field];
        if (typeof value === 'string' && value.length > limit) {
            return { ok: false, reason: `${FIELD_LABEL[field]} supera los ${limit} caracteres` };
        }
    }
    if (row.email && !EMAIL.test(row.email))
        return { ok: false, reason: `Correo con formato inválido: ${row.email}` };
    if (row.phone && !PHONE.test(row.phone)) {
        return { ok: false, reason: 'El teléfono solo admite números, espacios, paréntesis, + y -' };
    }
    if (row.altPhone && !PHONE.test(row.altPhone)) {
        return { ok: false, reason: 'El teléfono alternativo solo admite números, espacios, paréntesis, + y -' };
    }
    if (!row.email && !row.phone) {
        return { ok: false, reason: 'Sin correo ni teléfono: no hay forma de reconocer a la persona' };
    }
    const rawDate = text(raw.sourceCreatedAt);
    if (rawDate) {
        const parsed = new Date(rawDate);
        if (Number.isNaN(parsed.getTime()))
            return { ok: false, reason: `Fecha de origen ilegible: ${rawDate}` };
        row.sourceCreatedAt = parsed;
    }
    return { ok: true, row };
}
