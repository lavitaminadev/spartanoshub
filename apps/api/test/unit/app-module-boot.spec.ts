import { Test } from '@nestjs/testing';
import { getDataSourceToken, getEntityManagerToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';

/**
 * La aplicación completa debe poder armar su grafo de dependencias.
 *
 * Las pruebas unitarias construyen cada servicio a mano con dobles, así que un proveedor
 * inyectado sin declarar en su módulo las pasa todas y recién falla al arrancar. Pasó en
 * producción: `UpdateApprovalStatusUseCase` pedía `ProductionWorkflowService` y `ApprovalsModule`
 * no importaba el módulo que lo exporta. Passenger no logró levantar ningún proceso, y desde el
 * navegador se veía como un error de CORS —sin aplicación viva, nadie escribe la cabecera—.
 *
 * No necesita base de datos: sustituye la conexión por un doble, de modo que lo único que puede
 * fallar acá es el cableado entre módulos.
 */
describe('arranque de la aplicación', () => {
  it('resuelve todas las dependencias de todos los módulos', async () => {
    // `AppModule` se importa acá dentro para que la sustitución del entorno ocurra antes de que
    // el módulo lea sus variables al evaluarse.
    const { AppModule } = await import('../../src/app.module');

    const conexionFalsa = {
      isInitialized: true,
      driver: { options: { type: 'mysql' } },
      options: { type: 'mysql' },
      manager: {},
      // `@nestjs/typeorm` consulta estos metadatos para decidir qué tipo de repositorio crear.
      entityMetadatas: [],
      getRepository: () => ({}),
      getTreeRepository: () => ({}),
      createQueryRunner: () => ({ connect: vi.fn(), release: vi.fn(), manager: {} }),
      initialize: vi.fn(),
      destroy: vi.fn(),
      query: vi.fn(),
      runMigrations: vi.fn(),
    };

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue(conexionFalsa)
      .overrideProvider(DataSource)
      .useValue(conexionFalsa)
      .overrideProvider(getEntityManagerToken())
      .useValue(conexionFalsa.manager)
      .compile();

    expect(modulo).toBeDefined();
    await modulo.close();
  }, 120_000);
});
