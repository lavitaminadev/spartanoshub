"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ReservationsBulkImportService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationsBulkImportService = exports.MAX_IMPORT_ROWS = void 0;
const common_1 = require("@nestjs/common");
const papaparse_1 = require("papaparse");
const reservations_service_1 = require("./reservations.service");
exports.MAX_IMPORT_ROWS = 500;
const COLUMN_ALIASES = {
    guestname: 'guestName',
    guestemail: 'guestEmail',
    guestphone: 'guestPhone',
    startsat: 'startsAt',
    partysize: 'partySize',
    internalnotes: 'internalNotes',
    nombre: 'guestName',
    name: 'guestName',
    'nombre completo': 'guestName',
    email: 'guestEmail',
    correo: 'guestEmail',
    telefono: 'guestPhone',
    teléfono: 'guestPhone',
    phone: 'guestPhone',
    fecha: 'startsAt',
    'fecha y hora': 'startsAt',
    personas: 'partySize',
    'party size': 'partySize',
    notas: 'internalNotes',
    'notas internas': 'internalNotes',
};
function normalizeHeader(header) {
    return header.trim().toLowerCase();
}
let ReservationsBulkImportService = ReservationsBulkImportService_1 = class ReservationsBulkImportService {
    constructor(reservations) {
        this.reservations = reservations;
        this.logger = new common_1.Logger(ReservationsBulkImportService_1.name);
    }
    parse(csvContent, formId) {
        const parsed = (0, papaparse_1.parse)(csvContent.trim(), {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => COLUMN_ALIASES[normalizeHeader(header)] ?? normalizeHeader(header),
        });
        if (parsed.errors.length > 0) {
            const first = parsed.errors[0];
            throw new common_1.BadRequestException(`CSV inválido en la fila ${(first.row ?? 0) + 1}: ${first.message}`);
        }
        const records = parsed.data;
        if (records.length === 0)
            throw new common_1.BadRequestException('El archivo no tiene filas de datos');
        if (records.length > exports.MAX_IMPORT_ROWS) {
            throw new common_1.BadRequestException(`El archivo supera el máximo de ${exports.MAX_IMPORT_ROWS} filas. Divídelo en partes.`);
        }
        const rows = records.map((record, index) => this.validateRow(record, index + 1, formId));
        return {
            totalRows: rows.length,
            validRows: rows.filter((row) => row.errors.length === 0).length,
            rows,
        };
    }
    validateRow(record, rowNumber, formId) {
        const errors = [];
        const guestName = (record.guestName ?? '').trim();
        const guestEmail = (record.guestEmail ?? '').trim();
        const guestPhone = (record.guestPhone ?? '').trim();
        const rawDate = (record.startsAt ?? '').trim();
        if (!guestName)
            errors.push('Falta el nombre');
        if (guestName.length > 180)
            errors.push('El nombre supera 180 caracteres');
        if (!guestEmail && !guestPhone)
            errors.push('Se requiere email o teléfono');
        if (guestEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guestEmail))
            errors.push('Email inválido');
        let startsAt;
        if (!rawDate) {
            errors.push('Falta la fecha');
        }
        else {
            const parsedDate = new Date(rawDate);
            if (Number.isNaN(parsedDate.getTime()))
                errors.push(`Fecha inválida: "${rawDate}"`);
            else
                startsAt = parsedDate.toISOString();
        }
        let partySize;
        const rawPartySize = (record.partySize ?? '').trim();
        if (rawPartySize) {
            const value = Number(rawPartySize);
            if (!Number.isInteger(value) || value < 1 || value > 500)
                errors.push(`Cantidad de personas inválida: "${rawPartySize}"`);
            else
                partySize = value;
        }
        return {
            rowNumber,
            data: {
                formId,
                startsAt,
                guestName,
                guestEmail: guestEmail || undefined,
                guestPhone: guestPhone || undefined,
                partySize,
                internalNotes: (record.internalNotes ?? '').trim() || undefined,
            },
            errors,
        };
    }
    async import(organizationId, userId, csvContent, formId, options = {}) {
        const preview = this.parse(csvContent, formId);
        const errors = [];
        let imported = 0;
        for (const row of preview.rows) {
            if (row.errors.length > 0) {
                errors.push({ rowNumber: row.rowNumber, message: row.errors.join('; ') });
                continue;
            }
            try {
                await this.reservations.createManual(organizationId, userId, { ...row.data, skipAvailability: options.skipAvailability }, options.clientId, options.clientIds, false);
                imported += 1;
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Error desconocido';
                errors.push({ rowNumber: row.rowNumber, message });
            }
        }
        this.logger.log(`Importación de reservas: ${imported} creadas, ${errors.length} con error (form ${formId})`);
        return { imported, failed: errors.length, errors };
    }
};
exports.ReservationsBulkImportService = ReservationsBulkImportService;
exports.ReservationsBulkImportService = ReservationsBulkImportService = ReservationsBulkImportService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [reservations_service_1.ReservationsService])
], ReservationsBulkImportService);
//# sourceMappingURL=bulk-import.service.js.map