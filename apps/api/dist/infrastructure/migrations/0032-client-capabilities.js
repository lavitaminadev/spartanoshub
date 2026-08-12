"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientCapabilities1710000000032 = void 0;
const typeorm_1 = require("typeorm");
class ClientCapabilities1710000000032 {
    constructor() {
        this.name = 'ClientCapabilities1710000000032';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('clients', 'capabilities'))) {
            await queryRunner.addColumn('clients', new typeorm_1.TableColumn({
                name: 'capabilities',
                type: 'json',
                isNullable: true,
            }));
        }
        await queryRunner.query("UPDATE clients SET capabilities = JSON_OBJECT('reservations', true, 'crm', true, 'metaConversions', false) WHERE capabilities IS NULL");
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('clients', 'capabilities')) {
            await queryRunner.dropColumn('clients', 'capabilities');
        }
    }
}
exports.ClientCapabilities1710000000032 = ClientCapabilities1710000000032;
