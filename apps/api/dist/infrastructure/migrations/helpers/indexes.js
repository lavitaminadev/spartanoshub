"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureIndexes = ensureIndexes;
exports.dropIndexes = dropIndexes;
async function indexExists(queryRunner, table, name) {
    const rows = await queryRunner.query(`SELECT COUNT(*) AS total FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`, [table, name]);
    return Number(rows?.[0]?.total ?? 0) > 0;
}
async function columnsExist(queryRunner, table, columns) {
    const rows = await queryRunner.query(`SELECT COUNT(*) AS total FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name IN (${columns.map(() => '?').join(', ')})`, [table, ...columns]);
    return Number(rows?.[0]?.total ?? 0) === columns.length;
}
async function ensureIndexes(queryRunner, specs) {
    for (const spec of specs) {
        if (!(await queryRunner.hasTable(spec.table)))
            continue;
        if (!(await columnsExist(queryRunner, spec.table, spec.columns)))
            continue;
        if (await indexExists(queryRunner, spec.table, spec.name))
            continue;
        const definition = spec.definition ?? `(${spec.columns.join(', ')})`;
        await queryRunner.query(`ALTER TABLE \`${spec.table}\` ADD INDEX \`${spec.name}\` ${definition}`);
    }
}
async function dropIndexes(queryRunner, specs) {
    for (const spec of [...specs].reverse()) {
        if (!(await queryRunner.hasTable(spec.table)))
            continue;
        if (!(await indexExists(queryRunner, spec.table, spec.name)))
            continue;
        await queryRunner.query(`ALTER TABLE \`${spec.table}\` DROP INDEX \`${spec.name}\``);
    }
}
//# sourceMappingURL=indexes.js.map