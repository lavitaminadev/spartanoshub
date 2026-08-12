"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddClientLogo1724161000000 = void 0;
const typeorm_1 = require("typeorm");
class AddClientLogo1724161000000 {
    constructor() {
        this.name = 'AddClientLogo1724161000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('clients', 'logo_url'))) {
            await queryRunner.addColumn('clients', new typeorm_1.TableColumn({
                name: 'logo_url',
                type: 'varchar',
                length: '500',
                isNullable: true,
            }));
        }
        if (!(await queryRunner.hasColumn('clients', 'logo_public_id'))) {
            await queryRunner.addColumn('clients', new typeorm_1.TableColumn({
                name: 'logo_public_id',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }));
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('clients', 'logo_public_id')) {
            await queryRunner.dropColumn('clients', 'logo_public_id');
        }
        if (await queryRunner.hasColumn('clients', 'logo_url')) {
            await queryRunner.dropColumn('clients', 'logo_url');
        }
    }
}
exports.AddClientLogo1724161000000 = AddClientLogo1724161000000;
//# sourceMappingURL=0056-add-client-logo.js.map