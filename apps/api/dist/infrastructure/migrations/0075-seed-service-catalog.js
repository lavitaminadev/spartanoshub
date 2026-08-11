"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedServiceCatalog1726000000000 = void 0;
const SERVICES = [
    { name: 'Redes sociales', description: 'Gestión mensual de contenido, grilla y comunidad.', category: 'monthly' },
    { name: 'Campañas Meta', description: 'Estrategia, creatividades y gestión de pauta en Facebook e Instagram.', category: 'ads' },
    { name: 'Campañas Google', description: 'Búsqueda, display y remarketing en Google Ads.', category: 'ads' },
    { name: 'Audiovisual', description: 'Producción de video y fotografía: sesiones, edición y entrega.', category: 'project' },
    { name: 'Branding', description: 'Identidad visual, manual de marca y aplicaciones.', category: 'project' },
    { name: 'Diseño web', description: 'Diseño y desarrollo de sitio web.', category: 'project' },
    { name: 'Influencers', description: 'Selección, coordinación y medición de campañas con creadores.', category: 'project' },
    { name: 'Posicionamiento en IA', description: 'Visibilidad de la marca en buscadores y asistentes de inteligencia artificial.', category: 'project' },
];
class SeedServiceCatalog1726000000000 {
    constructor() {
        this.name = 'SeedServiceCatalog1726000000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('services')))
            return;
        const organizations = await queryRunner.query('SELECT id FROM `organizations`');
        for (const organization of organizations) {
            for (const service of SERVICES) {
                const [existing] = await queryRunner.query('SELECT id FROM `services` WHERE `organization_id` = ? AND `name` = ? LIMIT 1', [organization.id, service.name]);
                if (existing)
                    continue;
                await queryRunner.query('INSERT INTO `services` (`id`, `organization_id`, `name`, `description`, `category`, `currency`, `ud_per_unit`, `status`) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)', [organization.id, service.name, service.description, service.category, 'CLP', 0, 'active']);
            }
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('services')))
            return;
        const names = SERVICES.map((service) => service.name);
        await queryRunner.query('DELETE FROM `services` WHERE `name` IN (?) AND `id` NOT IN (SELECT DISTINCT `service_id` FROM `quote_items` WHERE `service_id` IS NOT NULL)', [names]);
    }
}
exports.SeedServiceCatalog1726000000000 = SeedServiceCatalog1726000000000;
//# sourceMappingURL=0075-seed-service-catalog.js.map