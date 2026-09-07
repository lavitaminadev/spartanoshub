"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaOutboxClientScope1758300000000 = void 0;
class MetaOutboxClientScope1758300000000 {
    constructor() {
        this.name = 'MetaOutboxClientScope1758300000000';
    }
    async up(queryRunner) {
        const columns = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'meta_conversion_outbox' AND column_name = 'client_id'");
        if (Number(columns?.[0]?.n ?? 0) === 0)
            await queryRunner.query('ALTER TABLE meta_conversion_outbox ADD COLUMN client_id CHAR(36) NULL AFTER organization_id');
        const indexes = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'meta_conversion_outbox' AND index_name = 'IDX_meta_conversion_outbox_client_pixel'");
        if (Number(indexes?.[0]?.n ?? 0) === 0)
            await queryRunner.query('CREATE INDEX IDX_meta_conversion_outbox_client_pixel ON meta_conversion_outbox (organization_id, client_id, pixel_id)');
    }
    async down(queryRunner) {
        const indexes = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'meta_conversion_outbox' AND index_name = 'IDX_meta_conversion_outbox_client_pixel'");
        if (Number(indexes?.[0]?.n ?? 0) > 0)
            await queryRunner.query('DROP INDEX IDX_meta_conversion_outbox_client_pixel ON meta_conversion_outbox');
        const columns = await queryRunner.query("SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'meta_conversion_outbox' AND column_name = 'client_id'");
        if (Number(columns?.[0]?.n ?? 0) > 0)
            await queryRunner.query('ALTER TABLE meta_conversion_outbox DROP COLUMN client_id');
    }
}
exports.MetaOutboxClientScope1758300000000 = MetaOutboxClientScope1758300000000;
