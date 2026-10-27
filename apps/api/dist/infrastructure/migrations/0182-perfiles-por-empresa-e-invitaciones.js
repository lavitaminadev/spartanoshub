"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerfilesPorEmpresaEInvitaciones1790000000182 = void 0;
const typeorm_1 = require("typeorm");
const catalogo_1 = require("./helpers/catalogo");
class PerfilesPorEmpresaEInvitaciones1790000000182 {
    constructor() {
        this.name = 'PerfilesPorEmpresaEInvitaciones1790000000182';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('user_client_access')) {
            const columnas = [
                ['retired_at', 'TIMESTAMP NULL'],
                ['retired_by', 'VARCHAR(36) NULL'],
                ['retired_reason', 'VARCHAR(300) NULL'],
                ['retired_outcome', 'VARCHAR(10) NULL'],
                ['reentered_at', 'TIMESTAMP NULL'],
                ['reentered_by', 'VARCHAR(36) NULL'],
                ['reentry_reason', 'VARCHAR(300) NULL'],
                ['previous_retired_at', 'TIMESTAMP NULL'],
            ];
            for (const [nombre, tipo] of columnas) {
                if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'user_client_access', nombre))) {
                    await queryRunner.query(`ALTER TABLE user_client_access ADD COLUMN ${nombre} ${tipo}`);
                }
            }
        }
        if (!(await queryRunner.hasTable('perfiles'))) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'perfiles',
                columns: [
                    { name: 'id', type: 'uuid', isPrimary: true },
                    { name: 'organization_id', type: 'uuid' },
                    { name: 'client_id', type: 'uuid' },
                    { name: 'name', type: 'varchar', length: '80' },
                    { name: 'description', type: 'varchar', length: '300', isNullable: true },
                    { name: 'areas', type: 'json' },
                    { name: 'protected_data', type: 'json' },
                    { name: 'created_by', type: 'uuid', isNullable: true },
                    { name: 'created_at', type: 'timestamp', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
                    { name: 'updated_at', type: 'timestamp', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
                ],
            }), true);
            await queryRunner.createIndex('perfiles', new typeorm_1.TableIndex({ name: 'UQ_perfil_empresa_nombre', columnNames: ['client_id', 'name'], isUnique: true }));
            await queryRunner.createForeignKey('perfiles', new typeorm_1.TableForeignKey({
                name: 'FK_perfiles_client',
                columnNames: ['client_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'clients',
                onDelete: 'CASCADE',
            }));
        }
        if (!(await queryRunner.hasTable('perfil_asignaciones'))) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'perfil_asignaciones',
                columns: [
                    { name: 'id', type: 'uuid', isPrimary: true },
                    { name: 'organization_id', type: 'uuid' },
                    { name: 'client_id', type: 'uuid' },
                    { name: 'user_id', type: 'uuid' },
                    { name: 'perfil_id', type: 'uuid' },
                    { name: 'assigned_by', type: 'uuid', isNullable: true },
                    { name: 'created_at', type: 'timestamp', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
                    { name: 'updated_at', type: 'timestamp', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
                ],
            }), true);
            await queryRunner.createIndex('perfil_asignaciones', new typeorm_1.TableIndex({ name: 'UQ_perfil_asignacion', columnNames: ['client_id', 'user_id'], isUnique: true }));
            await queryRunner.createIndex('perfil_asignaciones', new typeorm_1.TableIndex({ name: 'IDX_perfil_asignacion_perfil', columnNames: ['perfil_id'] }));
            await queryRunner.createForeignKeys('perfil_asignaciones', [
                new typeorm_1.TableForeignKey({
                    name: 'FK_perfil_asignacion_perfil',
                    columnNames: ['perfil_id'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'perfiles',
                    onDelete: 'CASCADE',
                }),
                new typeorm_1.TableForeignKey({
                    name: 'FK_perfil_asignacion_user',
                    columnNames: ['user_id'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'users',
                    onDelete: 'CASCADE',
                }),
            ]);
        }
        if (!(await queryRunner.hasTable('invitaciones_equipo'))) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'invitaciones_equipo',
                columns: [
                    { name: 'id', type: 'uuid', isPrimary: true },
                    { name: 'organization_id', type: 'uuid' },
                    { name: 'client_id', type: 'uuid' },
                    { name: 'email', type: 'varchar', length: '255' },
                    { name: 'perfil_id', type: 'uuid' },
                    { name: 'token_hash', type: 'varchar', length: '64' },
                    { name: 'invited_by', type: 'uuid' },
                    { name: 'expires_at', type: 'timestamp' },
                    { name: 'accepted_at', type: 'timestamp', isNullable: true },
                    { name: 'revoked_at', type: 'timestamp', isNullable: true },
                    { name: 'lifts_ban', type: 'tinyint', width: 1, default: 0 },
                    { name: 'reentry_reason', type: 'varchar', length: '300', isNullable: true },
                    { name: 'created_at', type: 'timestamp', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
                ],
            }), true);
            await queryRunner.createIndex('invitaciones_equipo', new typeorm_1.TableIndex({ name: 'UQ_invitacion_token', columnNames: ['token_hash'], isUnique: true }));
            await queryRunner.createIndex('invitaciones_equipo', new typeorm_1.TableIndex({ name: 'IDX_invitacion_empresa_correo', columnNames: ['client_id', 'email'] }));
            await queryRunner.createForeignKeys('invitaciones_equipo', [
                new typeorm_1.TableForeignKey({
                    name: 'FK_invitacion_client',
                    columnNames: ['client_id'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'clients',
                    onDelete: 'CASCADE',
                }),
                new typeorm_1.TableForeignKey({
                    name: 'FK_invitacion_perfil',
                    columnNames: ['perfil_id'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'perfiles',
                    onDelete: 'CASCADE',
                }),
            ]);
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('user_client_access')) {
            for (const nombre of ['previous_retired_at', 'reentry_reason', 'reentered_by', 'reentered_at', 'retired_outcome', 'retired_reason', 'retired_by', 'retired_at']) {
                if (await (0, catalogo_1.hayColumna)(queryRunner, 'user_client_access', nombre))
                    await queryRunner.query(`ALTER TABLE user_client_access DROP COLUMN ${nombre}`);
            }
        }
        for (const tabla of ['invitaciones_equipo', 'perfil_asignaciones', 'perfiles']) {
            if (await queryRunner.hasTable(tabla))
                await queryRunner.dropTable(tabla);
        }
    }
}
exports.PerfilesPorEmpresaEInvitaciones1790000000182 = PerfilesPorEmpresaEInvitaciones1790000000182;
