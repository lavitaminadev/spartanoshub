"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpportunityLossReason1725600000000 = void 0;
const typeorm_1 = require("typeorm");
class OpportunityLossReason1725600000000 {
    constructor() {
        this.name = 'OpportunityLossReason1725600000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('crm_opportunities', 'loss_reason'))) {
            await queryRunner.addColumn('crm_opportunities', new typeorm_1.TableColumn({
                name: 'loss_reason', type: 'varchar', length: '60', isNullable: true,
            }));
        }
        if (!(await queryRunner.hasColumn('crm_opportunities', 'loss_note'))) {
            await queryRunner.addColumn('crm_opportunities', new typeorm_1.TableColumn({
                name: 'loss_note', type: 'text', isNullable: true,
            }));
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('crm_opportunities', 'loss_note'))
            await queryRunner.dropColumn('crm_opportunities', 'loss_note');
        if (await queryRunner.hasColumn('crm_opportunities', 'loss_reason'))
            await queryRunner.dropColumn('crm_opportunities', 'loss_reason');
    }
}
exports.OpportunityLossReason1725600000000 = OpportunityLossReason1725600000000;
