"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermisoPorEmpresa1790000000151 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class PermisoPorEmpresa1790000000151 {
    constructor() {
        this.name = 'PermisoPorEmpresa1790000000151';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('user_permission_overrides')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'user_permission_overrides', 'client_id'))) {
            await queryRunner.query('ALTER TABLE user_permission_overrides ADD COLUMN client_id VARCHAR(36) NULL');
        }
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'user_permission_overrides', 'client_scope'))) {
            await queryRunner.query('ALTER TABLE user_permission_overrides ADD COLUMN client_scope VARCHAR(36) AS (COALESCE(client_id, \'*\')) STORED');
        }
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'user_permission_overrides', 'UQ_user_permission_override_client'))) {
            await queryRunner.query('CREATE UNIQUE INDEX UQ_user_permission_override_client ON user_permission_overrides (user_id, module, client_scope)');
        }
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'user_permission_overrides', 'UQ_user_permission_override')) {
            await queryRunner.query('DROP INDEX UQ_user_permission_override ON user_permission_overrides');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('user_permission_overrides')))
            return;
        await queryRunner.query('DELETE FROM user_permission_overrides WHERE client_id IS NOT NULL');
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'user_permission_overrides', 'UQ_user_permission_override'))) {
            await queryRunner.query('CREATE UNIQUE INDEX UQ_user_permission_override ON user_permission_overrides (user_id, module)');
        }
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'user_permission_overrides', 'UQ_user_permission_override_client')) {
            await queryRunner.query('DROP INDEX UQ_user_permission_override_client ON user_permission_overrides');
        }
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'user_permission_overrides', 'client_scope')) {
            await queryRunner.query('ALTER TABLE user_permission_overrides DROP COLUMN client_scope');
        }
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'user_permission_overrides', 'client_id')) {
            await queryRunner.query('ALTER TABLE user_permission_overrides DROP COLUMN client_id');
        }
    }
}
exports.PermisoPorEmpresa1790000000151 = PermisoPorEmpresa1790000000151;
