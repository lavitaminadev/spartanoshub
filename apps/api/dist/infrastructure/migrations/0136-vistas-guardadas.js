"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VistasGuardadas1758800000000 = void 0;
class VistasGuardadas1758800000000 {
    constructor() {
        this.name = 'VistasGuardadas1758800000000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('saved_views'))
            return;
        await queryRunner.query(`
      CREATE TABLE saved_views (
        id uuid NOT NULL,
        organization_id uuid NOT NULL,
        client_id uuid NULL,
        owner_user_id uuid NOT NULL,
        scope varchar(80) NOT NULL,
        name varchar(60) NOT NULL,
        filters json NOT NULL,
        shared tinyint(1) NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY UQ_saved_views_owner_scope_name (owner_user_id, scope, name),
        KEY IDX_saved_views_org_scope (organization_id, scope)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('saved_views'))
            await queryRunner.query('DROP TABLE saved_views');
    }
}
exports.VistasGuardadas1758800000000 = VistasGuardadas1758800000000;
