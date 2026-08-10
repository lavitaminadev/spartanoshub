import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Servicios que la agencia ofrece, tomados de las páginas del sitio público.
 *
 * El catálogo estaba construido y vacío, así que no se podía generar ni un presupuesto. Estos
 * ocho son los que el sitio publica con página propia; si el sitio ofrece un servicio que no
 * está acá, no se puede cotizar, y esa desincronización es la que conviene evitar desde el
 * primer día.
 *
 * Sin precio a propósito: los valores todavía no están cerrados —la brecha I del Documento
 * Maestro— y un precio inventado en una migración termina apareciendo en una cotización real.
 * Se cargan con `unit_price` nulo para que quien cotice tenga que ponerlo a conciencia.
 */
const SERVICES: Array<{ name: string; description: string; category: string }> = [
  { name: 'Redes sociales', description: 'Gestión mensual de contenido, grilla y comunidad.', category: 'monthly' },
  { name: 'Campañas Meta', description: 'Estrategia, creatividades y gestión de pauta en Facebook e Instagram.', category: 'ads' },
  { name: 'Campañas Google', description: 'Búsqueda, display y remarketing en Google Ads.', category: 'ads' },
  { name: 'Audiovisual', description: 'Producción de video y fotografía: sesiones, edición y entrega.', category: 'project' },
  { name: 'Branding', description: 'Identidad visual, manual de marca y aplicaciones.', category: 'project' },
  { name: 'Diseño web', description: 'Diseño y desarrollo de sitio web.', category: 'project' },
  { name: 'Influencers', description: 'Selección, coordinación y medición de campañas con creadores.', category: 'project' },
  { name: 'Posicionamiento en IA', description: 'Visibilidad de la marca en buscadores y asistentes de inteligencia artificial.', category: 'project' },
];

export class SeedServiceCatalog1726000000000 implements MigrationInterface {
  name = 'SeedServiceCatalog1726000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('services'))) return;

    const organizations: Array<{ id: string }> = await queryRunner.query('SELECT id FROM `organizations`');
    for (const organization of organizations) {
      for (const service of SERVICES) {
        // Se comprueba antes de insertar para que volver a ejecutar la migración no duplique
        // el catálogo ni pise una descripción que alguien haya ajustado.
        const [existing] = await queryRunner.query(
          'SELECT id FROM `services` WHERE `organization_id` = ? AND `name` = ? LIMIT 1',
          [organization.id, service.name],
        );
        if (existing) continue;

        await queryRunner.query(
          'INSERT INTO `services` (`id`, `organization_id`, `name`, `description`, `category`, `currency`, `ud_per_unit`, `status`) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)',
          [organization.id, service.name, service.description, service.category, 'CLP', 0, 'active'],
        );
      }
    }
  }

  /**
   * Retira solo los servicios que nadie ha usado todavía.
   *
   * Uno ya citado en una cotización se conserva: borrarlo dejaría el documento apuntando a un
   * servicio inexistente.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('services'))) return;
    const names = SERVICES.map((service) => service.name);
    await queryRunner.query(
      'DELETE FROM `services` WHERE `name` IN (?) AND `id` NOT IN (SELECT DISTINCT `service_id` FROM `quote_items` WHERE `service_id` IS NOT NULL)',
      [names],
    );
  }
}
