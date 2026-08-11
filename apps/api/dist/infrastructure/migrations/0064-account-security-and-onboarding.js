"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountSecurityAndOnboarding1724165000000 = void 0;
const typeorm_1 = require("typeorm");
class AccountSecurityAndOnboarding1724165000000 {
    constructor() {
        this.name = 'AccountSecurityAndOnboarding1724165000000';
        this.columns = [
            new typeorm_1.TableColumn({ name: 'failed_login_attempts', type: 'smallint', isNullable: false, default: 0 }),
            new typeorm_1.TableColumn({ name: 'locked_until', type: 'timestamp', isNullable: true }),
            new typeorm_1.TableColumn({ name: 'last_login_at', type: 'timestamp', isNullable: true }),
            new typeorm_1.TableColumn({ name: 'terms_accepted_at', type: 'timestamp', isNullable: true }),
            new typeorm_1.TableColumn({ name: 'terms_version', type: 'varchar', length: '20', isNullable: true }),
            new typeorm_1.TableColumn({ name: 'must_complete_profile', type: 'boolean', isNullable: false, default: false }),
        ];
    }
    async up(queryRunner) {
        for (const column of this.columns) {
            if (!(await queryRunner.hasColumn('users', column.name))) {
                await queryRunner.addColumn('users', column);
            }
        }
    }
    async down(queryRunner) {
        for (const column of this.columns) {
            if (await queryRunner.hasColumn('users', column.name)) {
                await queryRunner.dropColumn('users', column.name);
            }
        }
    }
}
exports.AccountSecurityAndOnboarding1724165000000 = AccountSecurityAndOnboarding1724165000000;
//# sourceMappingURL=0064-account-security-and-onboarding.js.map