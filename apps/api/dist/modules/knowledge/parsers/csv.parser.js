"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCsv = parseCsv;
const MAX_CSV_ROWS = 10000;
async function parseCsv(buffer, filename) {
    let papa;
    try {
        papa = await Promise.resolve().then(() => __importStar(require("papaparse")));
    }
    catch {
        return {
            text: "",
            metadata: { parser: "papaparse", originalName: filename, warning: "CSV parser could not be loaded." },
        };
    }
    const content = buffer.toString("utf-8").trim();
    if (!content)
        return {
            text: "",
            metadata: { parser: "papaparse", originalName: filename, warning: "CSV file is empty." },
        };
    try {
        const result = papa.parse(content, { header: true, skipEmptyLines: true, dynamicTyping: false });
        if (result.errors?.length && result.errors[0]?.type !== "FieldMismatch") {
            return {
                text: "",
                metadata: {
                    parser: "papaparse",
                    originalName: filename,
                    warning: `CSV parse error: ${result.errors[0]?.message}`,
                },
            };
        }
        const rows = result.data;
        const headers = result.meta.fields || [];
        const totalRows = rows.length;
        if (totalRows === 0)
            return {
                text: "",
                metadata: { parser: "papaparse", originalName: filename, warning: "CSV file has no data rows." },
            };
        const displayRows = rows.slice(0, MAX_CSV_ROWS);
        const lines = [
            `CSV Data: ${filename || "unknown"}\n`,
            `Columns: ${headers.join(", ")}`,
            `Total Rows: ${totalRows}${totalRows > MAX_CSV_ROWS ? ` (showing first ${MAX_CSV_ROWS})` : ""}\n`,
        ];
        for (let i = 0; i < displayRows.length; i++) {
            const row = displayRows[i];
            lines.push(`Row ${i + 1}:`);
            for (const key of headers) {
                const value = row[key] !== undefined ? String(row[key]).trim() : "";
                if (value)
                    lines.push(`  ${key}: ${value}`);
            }
            lines.push("");
        }
        return {
            text: lines.join("\n").trim(),
            metadata: { parser: "papaparse", originalName: filename, rows: totalRows },
        };
    }
    catch (error) {
        return {
            text: "",
            metadata: {
                parser: "papaparse",
                originalName: filename,
                warning: `CSV parsing failed: ${error instanceof Error ? error.message : "Unknown"}`,
            },
        };
    }
}
