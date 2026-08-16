"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentMillisecondPrecision1726900011000 = void 0;
class CommentMillisecondPrecision1726900011000 {
    constructor() {
        this.name = 'CommentMillisecondPrecision1726900011000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('process_comments')))
            return;
        await queryRunner.query('ALTER TABLE `process_comments` MODIFY `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)');
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('process_comments')))
            return;
        await queryRunner.query('ALTER TABLE `process_comments` MODIFY `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP');
    }
}
exports.CommentMillisecondPrecision1726900011000 = CommentMillisecondPrecision1726900011000;
