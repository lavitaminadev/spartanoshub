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
exports.parseHtml = parseHtml;
async function parseHtml(buffer, filename) {
    let cheerio;
    try {
        cheerio = await Promise.resolve().then(() => __importStar(require("cheerio")));
    }
    catch {
        return {
            text: "",
            metadata: { parser: "cheerio", originalName: filename, warning: "HTML parser could not be loaded." },
        };
    }
    const html = buffer.toString("utf-8").trim();
    if (!html)
        return {
            text: "",
            metadata: { parser: "cheerio", originalName: filename, warning: "HTML content is empty." },
        };
    try {
        const $ = cheerio.load(html);
        $("script, style, nav, footer, header, iframe, noscript, svg, form").remove();
        const title = $("title").first().text().trim();
        const metaDescription = $('meta[name="description"]').attr("content") || "";
        const contentParts = [];
        if (title)
            contentParts.push(`Title: ${title}`);
        if (metaDescription)
            contentParts.push(`Description: ${metaDescription}`);
        $("h1, h2, h3, h4, h5, h6").each((_, el) => {
            const t = $(el).text().trim();
            if (t)
                contentParts.push(`\n## ${t}`);
        });
        $("p").each((_, el) => {
            const t = $(el).text().trim();
            if (t)
                contentParts.push(t);
        });
        $("li").each((_, el) => {
            const t = $(el).text().trim();
            if (t)
                contentParts.push(`- ${t}`);
        });
        $("th, td").each((_, el) => {
            const t = $(el).text().trim();
            if (t)
                contentParts.push(t);
        });
        const cleanText = contentParts.join("\n").replace(/\n{4,}/g, "\n\n\n").replace(/[ \t]{3,}/g, "  ").trim();
        return {
            text: cleanText,
            metadata: { parser: "cheerio", title, originalName: filename },
        };
    }
    catch (error) {
        return {
            text: "",
            metadata: {
                parser: "cheerio",
                originalName: filename,
                warning: `HTML parsing failed: ${error instanceof Error ? error.message : "Unknown"}`,
            },
        };
    }
}
