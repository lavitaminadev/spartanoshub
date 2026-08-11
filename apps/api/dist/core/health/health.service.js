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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function readApiVersion() {
    const packagePath = path.resolve(__dirname, '../../../package.json');
    const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (typeof parsed.version !== 'string' || !parsed.version.trim()) {
        throw new Error(`Invalid API package version in ${packagePath}`);
    }
    return parsed.version;
}
const API_VERSION = readApiVersion();
let HealthService = class HealthService {
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async check() {
        const [db, memory, disk, redis] = await Promise.all([
            this.checkDb(),
            this.checkMemory(),
            this.checkDisk(),
            this.checkRedis(),
        ]);
        const status = db.status === 'ok' && memory.status === 'ok' ? 'ok' : 'degraded';
        return {
            status,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            version: API_VERSION,
            database: db,
            memory,
            disk,
            redis,
        };
    }
    async checkDb() {
        try {
            await this.dataSource.query('SELECT 1');
            return { status: 'ok', connected: true };
        }
        catch (error) {
            return { status: 'error', connected: false, message: error.message };
        }
    }
    async checkMemory() {
        const free = os.freemem();
        const total = os.totalmem();
        const usagePercent = Number(((1 - free / total) * 100).toFixed(1));
        return {
            status: usagePercent < 90 ? 'ok' : 'warning',
            freeMb: Math.round(free / 1024 / 1024),
            totalMb: Math.round(total / 1024 / 1024),
            usagePercent: `${usagePercent}%`,
        };
    }
    async checkDisk() {
        try {
            const tmpDir = os.tmpdir();
            const testFile = path.join(tmpDir, `vitahub_health_${Date.now()}.tmp`);
            fs.writeFileSync(testFile, 'ok');
            fs.unlinkSync(testFile);
            return { status: 'ok', writable: true };
        }
        catch (error) {
            return { status: 'error', writable: false, message: error.message };
        }
    }
    async checkRedis() {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl)
            return { status: 'not_configured', connected: false };
        return { status: 'configured_unverified', connected: null, url: redisUrl.split('@').pop() };
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], HealthService);
//# sourceMappingURL=health.service.js.map