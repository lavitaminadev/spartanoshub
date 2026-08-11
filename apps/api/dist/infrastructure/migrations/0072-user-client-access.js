"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserClientAccess1725800000000 = void 0;
const typeorm_1 = require("typeorm");
const PREVIOUSLY_UNRESTRICTED_ROLES = [
    'commercial_director',
    'operations_director',
    'creative_director',
    'art_director',
    'av_director',
    'ai_lead',
    'designer',
    'audiovisual',
];
class UserClientAccess1725800000000 {
    constructor() {
        this.name = 'UserClientAccess1725800000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('user_client_access'))) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'user_client_access',
                columns: [
                    { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
                    { name: 'organization_id', type: 'uuid' },
                    { name: 'user_id', type: 'uuid' },
                    { name: 'client_id', type: 'uuid' },
                    { name: 'reason', type: 'varchar', length: '255', isNullable: true },
                    { name: 'granted_by', type: 'uuid', isNullable: true },
                    { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                ],
                foreignKeys: [
                    new typeorm_1.TableForeignKey({ columnNames: ['organization_id'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
                    new typeorm_1.TableForeignKey({ columnNames: ['user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
                    new typeorm_1.TableForeignKey({ columnNames: ['client_id'], referencedTableName: 'clients', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
                    new typeorm_1.TableForeignKey({ columnNames: ['granted_by'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'SET NULL' }),
                ],
                indices: [
                    new typeorm_1.TableIndex({ name: 'UQ_user_client_access_pair', columnNames: ['user_id', 'client_id'], isUnique: true }),
                    new typeorm_1.TableIndex({ name: 'IDX_user_client_access_user', columnNames: ['organization_id', 'user_id'] }),
                ],
            }));
        }
        const roles = PREVIOUSLY_UNRESTRICTED_ROLES.map(() => '?').join(',');
        await queryRunner.query(`INSERT INTO \`user_client_access\` (\`id\`, \`organization_id\`, \`user_id\`, \`client_id\`, \`reason\`)
       SELECT UUID(), c.\`organization_id\`, u.\`id\`, c.\`id\`,
              'Acceso que el cargo ya ejercia antes del alcance por cuenta'
         FROM \`users\` u
         JOIN \`clients\` c ON c.\`organization_id\` = u.\`organization_id\`
        WHERE u.\`is_active\` = 1
          AND u.\`role\` IN (${roles})
          AND NOT EXISTS (
                SELECT 1 FROM \`user_client_access\` a
                 WHERE a.\`user_id\` = u.\`id\` AND a.\`client_id\` = c.\`id\`
              )`, PREVIOUSLY_UNRESTRICTED_ROLES);
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('user_client_access'))
            await queryRunner.dropTable('user_client_access');
    }
}
exports.UserClientAccess1725800000000 = UserClientAccess1725800000000;
//# sourceMappingURL=0072-user-client-access.js.map