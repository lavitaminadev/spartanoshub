import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';

/**
 * Las credenciales de Pixel salen del JSON y pasan a tener fila propia.
 *
 * Vivían todas dentro de `integrations.config`, un único campo de una única fila. Con tres
 * credenciales eso es más simple que una tabla; con novecientas empresas produce tres problemas
 * que no se pueden optimizar sin salir del JSON:
 *
 * - **Se lee entero en cada envío.** La cola manda de a un evento, así que cada conversión carga
 *   el mapa completo para sacar un token.
 * - **Cada cambio lo reescribe entero**, bajo un bloqueo que hace esperar a todas las demás
 *   empresas mientras se configura una.
 * - **La búsqueda es un recorrido**, y por eso el token acababa dependiendo del orden de las
 *   claves.
 *
 * La clave única `(organización, empresa, pixel)` es lo que convierte «encuéntrame cualquiera que
 * use este Pixel» en una consulta con dueño.
 *
 * **No se borra nada del JSON.** La lectura consulta la tabla y, si no encuentra, cae al JSON de
 * siempre; así, aunque esta copia fallara, lo configurado seguiría enviando igual. Retirar el
 * JSON es una decisión posterior, cuando lleve días sin usarse.
 *
 * Los tokens se copian **tal cual, cifrados**: no se descifran ni se vuelven a cifrar, de modo
 * que no hay ninguna forma de que la migración estropee uno.
 */
export class PixelsEnTabla1757200000000 implements MigrationInterface {
  name = 'PixelsEnTabla1757200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tablas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = 'meta_pixels'
    `);
    if (Number(tablas?.[0]?.n ?? 0) > 0) return;

    await queryRunner.query(`
      CREATE TABLE meta_pixels (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        client_id CHAR(36) NULL,
        pixel_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NULL,
        access_token TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    /*
     * `client_id` admite vacío y significa «del registro por Pixel»: una credencial declarada para
     * ese destino que no pertenece a ninguna empresa en concreto.
     *
     * MariaDB no considera iguales dos `NULL` en una clave única, así que dos filas con la misma
     * organización y Pixel pero sin empresa podrían coexistir. No se defiende con la restricción
     * sino al escribir, porque la alternativa —una columna centinela con un valor falso— obliga a
     * recordar ese valor en cada consulta.
     */
    await queryRunner.query(
      'ALTER TABLE meta_pixels ADD UNIQUE KEY UQ_meta_pixels_scope (organization_id, client_id, pixel_id)',
    );

    // La consulta de cada envío: «el token de este Pixel en esta organización».
    await queryRunner.query(
      'CREATE INDEX IDX_meta_pixels_org_pixel ON meta_pixels (organization_id, pixel_id)',
    );

    await this.copiarDesdeElJson(queryRunner);
  }

  /**
   * Copia lo que haya en `integrations.config` a la tabla.
   *
   * Se hace en JavaScript y no en SQL porque el JSON tiene dos formas distintas —el registro por
   * Pixel y el mapa por empresa— y extraer ambas con funciones de MariaDB sería una consulta que
   * nadie podría leer dentro de un año.
   */
  private async copiarDesdeElJson(queryRunner: QueryRunner): Promise<void> {
    const integraciones: Array<{ organization_id: string; config: string | null }> =
      await queryRunner.query(
        "SELECT organization_id, config FROM integrations WHERE provider = 'meta' AND config IS NOT NULL",
      );

    for (const fila of integraciones) {
      const config = typeof fila.config === 'string' ? JSON.parse(fila.config) : fila.config;
      if (!config || typeof config !== 'object') continue;

      // El registro por Pixel: sin empresa, porque describe el destino y no a quién lo usa.
      for (const [pixelId, credencial] of Object.entries(config.metaPixels ?? {})) {
        const datos = credencial as { name?: string; accessToken?: string };
        await queryRunner.query(
          'INSERT INTO meta_pixels (id, organization_id, client_id, pixel_id, name, access_token) VALUES (?, ?, NULL, ?, ?, ?)',
          [randomUUID(), fila.organization_id, pixelId, datos?.name ?? null, datos?.accessToken ?? null],
        );
      }

      // El mapa por empresa, tal como estaba: cada empresa con su Pixel y su token.
      for (const [clientId, registro] of Object.entries(config.clientPixels ?? {})) {
        const datos = registro as { pixelId?: string; pixelName?: string; accessToken?: string };
        if (!datos?.pixelId) continue;
        await queryRunner.query(
          'INSERT INTO meta_pixels (id, organization_id, client_id, pixel_id, name, access_token) VALUES (?, ?, ?, ?, ?, ?)',
          [randomUUID(), fila.organization_id, clientId, datos.pixelId, datos.pixelName ?? null, datos.accessToken ?? null],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // El JSON nunca se tocó, así que quitar la tabla devuelve el sistema a como estaba.
    await queryRunner.query('DROP TABLE IF EXISTS meta_pixels');
  }
}
