"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessComment = exports.CommentVisibility = exports.CommentSubject = void 0;
const typeorm_1 = require("typeorm");
var CommentSubject;
(function (CommentSubject) {
    CommentSubject["PIECE"] = "piece";
    CommentSubject["SESSION"] = "session";
    CommentSubject["WORK_REQUEST"] = "work_request";
})(CommentSubject || (exports.CommentSubject = CommentSubject = {}));
var CommentVisibility;
(function (CommentVisibility) {
    CommentVisibility["INTERNAL"] = "internal";
    CommentVisibility["CLIENT"] = "client";
})(CommentVisibility || (exports.CommentVisibility = CommentVisibility = {}));
let ProcessComment = class ProcessComment {
};
exports.ProcessComment = ProcessComment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ProcessComment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ProcessComment.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'subject_type', type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], ProcessComment.prototype, "subjectType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'subject_id', type: 'uuid' }),
    __metadata("design:type", String)
], ProcessComment.prototype, "subjectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'author_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ProcessComment.prototype, "authorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'author_role', type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], ProcessComment.prototype, "authorRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'author_name', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], ProcessComment.prototype, "authorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ProcessComment.prototype, "body", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: CommentVisibility.INTERNAL }),
    __metadata("design:type", String)
], ProcessComment.prototype, "visibility", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'edited_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], ProcessComment.prototype, "editedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'anonymized_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], ProcessComment.prototype, "anonymizedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'datetime', precision: 3 }),
    __metadata("design:type", Date)
], ProcessComment.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ProcessComment.prototype, "updatedAt", void 0);
exports.ProcessComment = ProcessComment = __decorate([
    (0, typeorm_1.Entity)('process_comments'),
    (0, typeorm_1.Index)('IDX_process_comment_subject', ['organizationId', 'subjectType', 'subjectId', 'createdAt'])
], ProcessComment);
