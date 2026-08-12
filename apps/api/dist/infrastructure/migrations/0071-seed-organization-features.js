"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedOrganizationFeatures1725700000000 = void 0;
const organization_features_1 = require("../../modules/organizations/organization-features");
const NEWLY_GOVERNED = [
    'content',
    'meetings',
    'approvals',
    'reports',
    'operations',
    'udBudget',
    'governance',
    'direction',
];
class SeedOrganizationFeatures1725700000000 {
    constructor() {
        this.name = 'SeedOrganizationFeatures1725700000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('organizations', 'features')))
            return;
        const features = { ...organization_features_1.DEFAULT_ORGANIZATION_FEATURES };
        for (const key of NEWLY_GOVERNED)
            features[key] = true;
        await queryRunner.query('UPDATE `organizations` SET `features` = ? WHERE `features` IS NULL', [JSON.stringify(features)]);
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasColumn('organizations', 'features')))
            return;
        const features = { ...organization_features_1.DEFAULT_ORGANIZATION_FEATURES };
        for (const key of NEWLY_GOVERNED)
            features[key] = true;
        await queryRunner.query('UPDATE `organizations` SET `features` = NULL WHERE `features` = CAST(? AS JSON)', [JSON.stringify(features)]);
    }
}
exports.SeedOrganizationFeatures1725700000000 = SeedOrganizationFeatures1725700000000;
