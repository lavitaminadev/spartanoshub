"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentoYLimitePorPersona1790000000156 = void 0;
const shared_1 = require("@espartanos/shared");
const fecha_de_nacimiento_1 = require("../../modules/reservations/application/fecha-de-nacimiento");
const catalogo_1 = require("./helpers/catalogo");
class DocumentoYLimitePorPersona1790000000156 {
    constructor() {
        this.name = 'DocumentoYLimitePorPersona1790000000156';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('reservations')) {
            if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservations', 'guest_document_type'))) {
                await queryRunner.query('ALTER TABLE reservations ADD COLUMN guest_document_type VARCHAR(12) NULL');
            }
            if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservations', 'guest_document_country'))) {
                await queryRunner.query('ALTER TABLE reservations ADD COLUMN guest_document_country CHAR(2) NULL');
            }
            if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservations', 'guest_document'))) {
                await queryRunner.query('ALTER TABLE reservations ADD COLUMN guest_document VARCHAR(40) NULL');
            }
            if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'reservations', 'IDX_reservations_cupon_por_persona'))) {
                await queryRunner.query('CREATE INDEX IDX_reservations_cupon_por_persona ON reservations (client_id, coupon_code)');
            }
        }
        if (await queryRunner.hasTable('reservation_coupons')) {
            if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservation_coupons', 'max_uses_per_person'))) {
                await queryRunner.query('ALTER TABLE reservation_coupons ADD COLUMN max_uses_per_person INT NOT NULL DEFAULT 0');
            }
            if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservation_coupons', 'person_keys'))) {
                await queryRunner.query('ALTER TABLE reservation_coupons ADD COLUMN person_keys JSON NULL');
            }
        }
        await this.rellenarDesdeLasRespuestas(queryRunner);
    }
    async rellenarDesdeLasRespuestas(queryRunner) {
        if (!(await queryRunner.hasTable('reservation_forms')) || !(await queryRunner.hasTable('reservations')))
            return;
        const formularios = await queryRunner.query('SELECT id, field_schema FROM reservation_forms');
        for (const formulario of formularios) {
            const esquema = leerJson(formulario.field_schema);
            if (!Array.isArray(esquema))
                continue;
            const campos = esquema;
            const campoDocumento = campos.find((campo) => campo.type === 'document' || campo.type === 'rut')?.id;
            const campoNacimiento = campos.find((campo) => campo.type === 'birthdate')?.id;
            if (!campoDocumento && !campoNacimiento)
                continue;
            const reservas = await queryRunner.query('SELECT id, answers, guest_document, birth_date FROM reservations WHERE form_id = ? AND (guest_document IS NULL OR birth_date IS NULL)', [formulario.id]);
            for (const reserva of reservas) {
                const respuestas = leerJson(reserva.answers);
                if (!respuestas)
                    continue;
                if (campoDocumento && !reserva.guest_document) {
                    const documento = (0, shared_1.leerDocumento)(respuestas[campoDocumento]);
                    if (documento) {
                        await queryRunner.query('UPDATE reservations SET guest_document_type = ?, guest_document_country = ?, guest_document = ? WHERE id = ? AND guest_document IS NULL', [documento.tipo, documento.pais, documento.numero, reserva.id]);
                    }
                }
                if (campoNacimiento && !reserva.birth_date) {
                    const fecha = respuestas[campoNacimiento];
                    if (typeof fecha === 'string' && (0, fecha_de_nacimiento_1.fechaDeNacimientoValida)(fecha)) {
                        await queryRunner.query('UPDATE reservations SET birth_date = ? WHERE id = ? AND birth_date IS NULL', [fecha.slice(0, 10), reserva.id]);
                    }
                }
            }
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('reservation_coupons')) {
            if (await (0, catalogo_1.hayColumna)(queryRunner, 'reservation_coupons', 'person_keys'))
                await queryRunner.query('ALTER TABLE reservation_coupons DROP COLUMN person_keys');
            if (await (0, catalogo_1.hayColumna)(queryRunner, 'reservation_coupons', 'max_uses_per_person'))
                await queryRunner.query('ALTER TABLE reservation_coupons DROP COLUMN max_uses_per_person');
        }
        if (await queryRunner.hasTable('reservations')) {
            if (await (0, catalogo_1.hayIndice)(queryRunner, 'reservations', 'IDX_reservations_cupon_por_persona'))
                await queryRunner.query('DROP INDEX IDX_reservations_cupon_por_persona ON reservations');
            for (const columna of ['guest_document', 'guest_document_country', 'guest_document_type']) {
                if (await (0, catalogo_1.hayColumna)(queryRunner, 'reservations', columna))
                    await queryRunner.query(`ALTER TABLE reservations DROP COLUMN ${columna}`);
            }
        }
    }
}
exports.DocumentoYLimitePorPersona1790000000156 = DocumentoYLimitePorPersona1790000000156;
function leerJson(valor) {
    if (typeof valor !== 'string')
        return valor ?? null;
    try {
        return JSON.parse(valor);
    }
    catch {
        return null;
    }
}
