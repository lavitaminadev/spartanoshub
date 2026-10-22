import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { readBuildInfo } from '../../../src/core/health/health.service';

const carpeta = mkdtempSync(join(tmpdir(), 'build-info-'));

describe('readBuildInfo', () => {
  it('devuelve el commit y la fecha que dejó el despliegue', () => {
    const archivo = join(carpeta, 'ok.json');
    writeFileSync(archivo, JSON.stringify({ commit: '1647814f0a9b', builtAt: '2026-10-21T12:00:00Z' }));
    expect(readBuildInfo(archivo)).toEqual({ commit: '1647814f0a9b', builtAt: '2026-10-21T12:00:00Z' });
  });

  it('dice desconocido si el archivo no está o no se entiende', () => {
    const roto = join(carpeta, 'roto.json');
    writeFileSync(roto, 'no es json');
    const desconocido = { commit: 'desconocido', builtAt: 'desconocido' };
    expect(readBuildInfo(join(carpeta, 'no-existe.json'))).toEqual(desconocido);
    expect(readBuildInfo(roto)).toEqual(desconocido);
  });
});
