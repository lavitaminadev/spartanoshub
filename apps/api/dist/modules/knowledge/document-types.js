"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_FILE_SIZE = exports.ALLOWED_EXTENSIONS = exports.ALLOWED_MIME_TYPES = void 0;
exports.ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/csv",
    "text/html",
];
exports.ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv", ".html"];
exports.MAX_FILE_SIZE = 10 * 1024 * 1024;
