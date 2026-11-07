"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccionPorEmpresa1790000000189 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class AccionPorEmpresa1790000000189 {
    constructor() {
        this.name = 'AccionPorEmpresa1790000000189';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('user_action_overrides')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'user_action_overrides', 'client_id'))) {
            await queryRunner.query('ALTER TABLE user_action_overrides ADD COLUMN client_id VARCHAR(36) NULL');
        }
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'user_action_overrides', 'client_scope'))) {
            await queryRunner.query('ALTER TABLE user_action_overrides ADD COLUMN client_scope VARCHAR(36) AS (COALESCE(client_id, \'*\')) STORED');
        }
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'user_action_overrides', 'UQ_user_action_override_client'))) {
            await queryRunner.query('CREATE UNIQUE INDEX UQ_user_action_override_client ON user_action_overrides (user_id, action, client_scope)');
        }
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'user_action_overrides', 'UQ_user_action_override')) {
            await queryRunner.query('DROP INDEX UQ_user_action_override ON user_action_overrides');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('user_action_overrides')))
            return;
        await queryRunner.query('DELETE FROM user_action_overrides WHERE client_id IS NOT NULL');
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'user_action_overrides', 'UQ_user_action_override'))) {
            await queryRunner.query('CREATE UNIQUE INDEX UQ_user_action_override ON user_action_overrides (user_id, action)');
        }
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'user_action_overrides', 'UQ_user_action_override_client')) {
            await queryRunner.query('DROP INDEX UQ_user_action_override_client ON user_action_overrides');
        }
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'user_action_overrides', 'client_scope')) {
            await queryRunner.query('ALTER TABLE user_action_overrides DROP COLUMN client_scope');
        }
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'user_action_overrides', 'client_id')) {
            await queryRunner.query('ALTER TABLE user_action_overrides DROP COLUMN client_id');
        }
    }
}
exports.AccionPorEmpresa1790000000189 = AccionPorEmpresa1790000000189;
