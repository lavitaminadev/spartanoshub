"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserCrmProfile1756000002000 = void 0;
const typeorm_1 = require("typeorm");
class UserCrmProfile1756000002000 {
    constructor() {
        this.name = 'UserCrmProfile1756000002000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasColumn('users', 'crm_profile'))
            return;
        await queryRunner.addColumn('users', new typeorm_1.TableColumn({
            name: 'crm_profile',
            type: 'varchar',
            length: '20',
            isNullable: true,
            comment: 'principal | venta. Nulo: lo decide el cargo.',
        }));
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasColumn('users', 'crm_profile')))
            return;
        await queryRunner.dropColumn('users', 'crm_profile');
    }
}
exports.UserCrmProfile1756000002000 = UserCrmProfile1756000002000;
