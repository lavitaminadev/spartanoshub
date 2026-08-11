"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefensiveFksChargeNotesCycles1721766500000 = void 0;
const typeorm_1 = require("typeorm");
class DefensiveFksChargeNotesCycles1721766500000 {
    constructor() {
        this.name = 'DefensiveFksChargeNotesCycles1721766500000';
        this.candidates = [
            { table: 'account_cycles', column: 'organization_id', referencedTable: 'organizations', onDelete: 'CASCADE', nullable: false },
            { table: 'account_cycles', column: 'client_id', referencedTable: 'clients', onDelete: 'CASCADE', nullable: false },
            { table: 'charge_notes', column: 'organization_id', referencedTable: 'organizations', onDelete: 'CASCADE', nullable: false },
            { table: 'charge_notes', column: 'client_id', referencedTable: 'clients', onDelete: 'RESTRICT', nullable: false },
            { table: 'charge_notes', column: 'piece_id', referencedTable: 'pieces', onDelete: 'CASCADE', nullable: false },
            { table: 'charge_notes', column: 'correction_id', referencedTable: 'corrections', onDelete: 'CASCADE', nullable: false },
            { table: 'charge_notes', column: 'invoice_id', referencedTable: 'invoices', onDelete: 'SET NULL', nullable: true },
            { table: 'charge_notes', column: 'created_by', referencedTable: 'users', onDelete: 'SET NULL', nullable: true },
        ];
    }
    async up(queryRunner) {
        for (const candidate of this.candidates) {
            const table = await queryRunner.getTable(candidate.table);
            const alreadyExists = table?.foreignKeys.some((key) => key.columnNames.includes(candidate.column) && key.referencedTableName === candidate.referencedTable);
            if (alreadyExists)
                continue;
            const nullClause = candidate.nullable ? `AND t.${candidate.column} IS NOT NULL` : '';
            const orphanRows = await queryRunner.query(`SELECT COUNT(*) as orphans FROM ${candidate.table} t
         LEFT JOIN ${candidate.referencedTable} r ON t.${candidate.column} = r.id
         WHERE r.id IS NULL ${nullClause}`);
            const orphanCount = Number(orphanRows[0]?.orphans ?? 0);
            if (orphanCount > 0) {
                console.warn(`[migration 0054] Saltando FK ${candidate.table}.${candidate.column} -> ${candidate.referencedTable}: ` +
                    `${orphanCount} fila(s) huerfana(s) encontradas. Revisar y limpiar antes de agregar la constraint manualmente.`);
                continue;
            }
            await queryRunner.createForeignKey(candidate.table, new typeorm_1.TableForeignKey({
                columnNames: [candidate.column],
                referencedTableName: candidate.referencedTable,
                referencedColumnNames: ['id'],
                onDelete: candidate.onDelete,
            }));
        }
    }
    async down(queryRunner) {
        for (const candidate of this.candidates) {
            const tableSchema = await queryRunner.getTable(candidate.table);
            const foreignKey = tableSchema?.foreignKeys.find((key) => key.columnNames.includes(candidate.column) && key.referencedTableName === candidate.referencedTable);
            if (foreignKey)
                await queryRunner.dropForeignKey(candidate.table, foreignKey);
        }
    }
}
exports.DefensiveFksChargeNotesCycles1721766500000 = DefensiveFksChargeNotesCycles1721766500000;
//# sourceMappingURL=0054-defensive-fks-charge-notes-cycles.js.map