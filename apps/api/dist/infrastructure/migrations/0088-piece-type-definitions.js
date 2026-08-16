"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PieceTypeDefinitions1726900008000 = void 0;
const typeorm_1 = require("typeorm");
const piece_type_enum_1 = require("../../modules/production/piece-type.enum");
const ud_calculator_1 = require("../../modules/design-budget/ud-calculator");
class PieceTypeDefinitions1726900008000 {
    constructor() {
        this.name = 'PieceTypeDefinitions1726900008000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('piece_type_definitions'))) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'piece_type_definitions',
                columns: [
                    { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                    { name: 'organization_id', type: 'varchar', length: '36' },
                    { name: 'key', type: 'varchar', length: '50' },
                    { name: 'label', type: 'varchar', length: '100' },
                    { name: 'area', type: 'varchar', length: '20', default: "'design'" },
                    { name: 'ud_amount', type: 'decimal', precision: 8, scale: 2, isNullable: true },
                    { name: 'xp_weight', type: 'decimal', precision: 5, scale: 2, default: 1 },
                    { name: 'extra_per_unit', type: 'decimal', precision: 8, scale: 2, isNullable: true },
                    { name: 'is_print', type: 'boolean', default: false },
                    { name: 'status', type: 'varchar', length: '20', default: "'draft'" },
                    { name: 'requested_by', type: 'varchar', length: '36', isNullable: true },
                    { name: 'approved_by', type: 'varchar', length: '36', isNullable: true },
                    { name: 'approved_at', type: 'timestamp', isNullable: true },
                    { name: 'notes', type: 'varchar', length: '500', isNullable: true },
                    { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                    { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
                ],
            }), true);
            await queryRunner.createIndex('piece_type_definitions', new typeorm_1.TableIndex({
                name: 'UQ_piece_type_org_key', columnNames: ['organization_id', 'key'], isUnique: true,
            }));
        }
        const organizations = await queryRunner.query('SELECT id FROM organizations');
        if (!organizations.length)
            return;
        const configurados = new Map();
        const filas = await queryRunner.query(`
      SELECT d.key AS \`key\`, v.scope_id, v.value_json
      FROM parameter_values v
      JOIN parameter_definitions d ON d.id = v.definition_id
      WHERE v.scope_type = 'organization' AND d.key LIKE 'ud.value.%' AND v.valid_to IS NULL
    `).catch(() => []);
        for (const fila of filas) {
            const parsed = typeof fila.value_json === 'string' ? JSON.parse(fila.value_json) : fila.value_json;
            const valor = parsed?.value;
            if (valor !== null && valor !== undefined)
                configurados.set(`${fila.scope_id}:${fila.key}`, Number(valor));
        }
        const impresas = new Set(piece_type_enum_1.PRINT_PIECE_TYPES);
        for (const organization of organizations) {
            for (const type of Object.values(piece_type_enum_1.PieceType)) {
                const configurado = configurados.get(`${organization.id}:${(0, ud_calculator_1.udValueKey)(type)}`);
                const ud = configurado ?? ud_calculator_1.UD_DEFAULTS[type] ?? null;
                await queryRunner.query(`INSERT IGNORE INTO piece_type_definitions
             (id, organization_id, \`key\`, label, area, ud_amount, xp_weight, extra_per_unit, is_print, status, approved_at, notes)
           VALUES (UUID(), ?, ?, ?, 'design', ?, 1, ?, ?, 'active', CURRENT_TIMESTAMP, ?)`, [
                    organization.id,
                    type,
                    piece_type_enum_1.PIECE_TYPE_LABELS[type],
                    ud,
                    type === piece_type_enum_1.PieceType.CAROUSEL ? 0.4 : null,
                    impresas.has(type) ? 1 : 0,
                    ud === null ? 'Enumerado por Dirección de Arte; falta decidir su valor.' : 'Catálogo inicial del Documento Maestro 6.1.',
                ]);
            }
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('piece_type_definitions')) {
            await queryRunner.dropTable('piece_type_definitions');
        }
    }
}
exports.PieceTypeDefinitions1726900008000 = PieceTypeDefinitions1726900008000;
