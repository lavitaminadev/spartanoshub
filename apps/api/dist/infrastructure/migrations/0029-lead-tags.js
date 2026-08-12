"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadTags1710000000029 = void 0;
const typeorm_1 = require("typeorm");
class LeadTags1710000000029 {
    constructor() {
        this.name = 'LeadTags1710000000029';
    }
    async up(queryRunner) {
        if (!await queryRunner.hasColumn('leads', 'tags')) {
            await queryRunner.addColumn('leads', new typeorm_1.TableColumn({ name: 'tags', type: 'json', isNullable: true }));
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('leads', 'tags')) {
            await queryRunner.dropColumn('leads', 'tags');
        }
    }
}
exports.LeadTags1710000000029 = LeadTags1710000000029;
