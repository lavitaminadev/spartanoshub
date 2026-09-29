"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermisosDelPortalEnSuEmpresa1790000000160 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class PermisosDelPortalEnSuEmpresa1790000000160 {
    constructor() {
        this.name = 'PermisosDelPortalEnSuEmpresa1790000000160';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('user_permission_overrides')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'user_permission_overrides', 'client_id')))
            return;
        await queryRunner.query(`
      DELETE o FROM user_permission_overrides o
      JOIN users quien_concede ON quien_concede.id = o.granted_by AND quien_concede.role = 'client'
      JOIN users destino ON destino.id = o.user_id AND destino.role = 'client' AND destino.client_id IS NOT NULL
      JOIN (
        SELECT user_id, module, client_id FROM user_permission_overrides WHERE client_id IS NOT NULL
      ) especifica ON especifica.user_id = o.user_id AND especifica.module = o.module AND especifica.client_id = destino.client_id
      WHERE o.client_id IS NULL
    `);
        await queryRunner.query(`
      UPDATE user_permission_overrides o
      JOIN users quien_concede ON quien_concede.id = o.granted_by AND quien_concede.role = 'client'
      JOIN users destino ON destino.id = o.user_id AND destino.role = 'client' AND destino.client_id IS NOT NULL
      SET o.client_id = destino.client_id
      WHERE o.client_id IS NULL
    `);
    }
    async down() {
    }
}
exports.PermisosDelPortalEnSuEmpresa1790000000160 = PermisosDelPortalEnSuEmpresa1790000000160;
