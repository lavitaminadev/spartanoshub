"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermisoPorEmpresa1790000000151 = void 0;
const typeorm_1 = require("typeorm");
class PermisoPorEmpresa1790000000151 {
    constructor() {
        this.name = 'PermisoPorEmpresa1790000000151';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('user_permission_overrides')))
            return;
        const tabla = await queryRunner.getTable('user_permission_overrides');
        if (!tabla?.findColumnByName('client_id')) {
            await queryRunner.addColumn('user_permission_overrides', new typeorm_1.TableColumn({ name: 'client_id', type: 'varchar', length: '36', isNullable: true }));
        }
        if (!tabla?.findColumnByName('client_scope')) {
            await queryRunner.query('ALTER TABLE user_permission_overrides ADD COLUMN client_scope VARCHAR(36) AS (COALESCE(client_id, \'*\')) STORED');
        }
        const indices = (await queryRunner.getTable('user_permission_overrides'))?.indices ?? [];
        if (indices.some((indice) => indice.name === 'UQ_user_permission_override')) {
            await queryRunner.query('DROP INDEX UQ_user_permission_override ON user_permission_overrides');
        }
        if (!indices.some((indice) => indice.name === 'UQ_user_permission_override_client')) {
            await queryRunner.query('CREATE UNIQUE INDEX UQ_user_permission_override_client ON user_permission_overrides (user_id, module, client_scope)');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('user_permission_overrides')))
            return;
        const tabla = await queryRunner.getTable('user_permission_overrides');
        const indices = tabla?.indices ?? [];
        if (indices.some((indice) => indice.name === 'UQ_user_permission_override_client')) {
            await queryRunner.query('DROP INDEX UQ_user_permission_override_client ON user_permission_overrides');
        }
        await queryRunner.query('DELETE FROM user_permission_overrides WHERE client_id IS NOT NULL');
        if (tabla?.findColumnByName('client_scope'))
            await queryRunner.query('ALTER TABLE user_permission_overrides DROP COLUMN client_scope');
        if (tabla?.findColumnByName('client_id'))
            await queryRunner.dropColumn('user_permission_overrides', 'client_id');
        await queryRunner.query('CREATE UNIQUE INDEX UQ_user_permission_override ON user_permission_overrides (user_id, module)');
    }
}
exports.PermisoPorEmpresa1790000000151 = PermisoPorEmpresa1790000000151;
