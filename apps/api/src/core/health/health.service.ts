import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

function readApiVersion(): string {
  const packagePath = path.resolve(__dirname, '../../../package.json');
  const parsed = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { version?: unknown };
  if (typeof parsed.version !== 'string' || !parsed.version.trim()) {
    throw new Error(`Invalid API package version in ${packagePath}`);
  }
  return parsed.version;
}

const API_VERSION = readApiVersion();

export interface BuildInfo {
  commit: string;
  builtAt: string;
}

/**
 * Qué build está corriendo, según el archivo que el flujo de despliegue escribe junto a `main.js`.
 *
 * Si el archivo no está o no se entiende, ambos campos son «desconocido»: es la respuesta
 * honesta de un servidor que no puede saber de qué commit salió.
 */
export function readBuildInfo(file = path.resolve(__dirname, '../../build-info.json')): BuildInfo {
  const desconocido: BuildInfo = { commit: 'desconocido', builtAt: 'desconocido' };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { commit?: unknown; builtAt?: unknown };
    const commit = typeof parsed.commit === 'string' && /^[0-9a-f]{7,40}$/i.test(parsed.commit.trim()) ? parsed.commit.trim() : null;
    const builtAt = typeof parsed.builtAt === 'string' && !Number.isNaN(Date.parse(parsed.builtAt)) ? parsed.builtAt : null;
    return { commit: commit ?? desconocido.commit, builtAt: builtAt ?? desconocido.builtAt };
  } catch {
    return desconocido;
  }
}

const BUILD = readBuildInfo();

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async check() {
    const [db, memory, disk, redis] = await Promise.all([
      this.checkDb(),
      this.checkMemory(),
      this.checkDisk(),
      this.checkRedis(),
    ]);

    const status =
      db.status === 'ok' && memory.status === 'ok' ? 'ok' : 'degraded';

    return {
      status,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      // Passenger inicia `node app.js` directamente, por lo que npm_package_version no existe.
      version: API_VERSION,
      commit: BUILD.commit,
      builtAt: BUILD.builtAt,
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
    } catch (error) {
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
      const testFile = path.join(tmpDir, `espartanos_health_${Date.now()}.tmp`);
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      return { status: 'ok', writable: true };
    } catch (error) {
      return { status: 'error', writable: false, message: error.message };
    }
  }

  async checkRedis() {
    // Redis es opcional y hoy no está conectado a ninguna lógica de caché/sesión —
    // esto solo informa si REDIS_URL está configurada, NO hace ping al servidor.
    // Nunca reportar "ok"/connected:true aquí sin una verificación real de conexión,
    // o este health check terminaría mintiendo sobre una dependencia caída.
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return { status: 'not_configured', connected: false };
    return { status: 'configured_unverified', connected: null, url: redisUrl.split('@').pop() };
  }
}
