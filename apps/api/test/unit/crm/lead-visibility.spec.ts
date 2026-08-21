import { describe, expect, it } from 'vitest';
import { veSoloLoSuyo } from '../../../src/modules/crm/leads/lead-visibility';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

describe('veSoloLoSuyo · segunda reja del CRM', () => {
  it('la administración y las direcciones ven el embudo completo', () => {
    for (const rol of [
      UserRole.DEV, UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR,
      UserRole.OPERATIONS_DIRECTOR, UserRole.CREATIVE_DIRECTOR,
      UserRole.ART_DIRECTOR, UserRole.AV_DIRECTOR,
    ]) {
      expect(veSoloLoSuyo(rol), rol).toBe(false);
    }
  });

  it('el cliente ve todos los leads de su empresa: quién los trabaja es asunto interno', () => {
    expect(veSoloLoSuyo(UserRole.CLIENT)).toBe(false);
  });

  it('el resto del equipo queda acotado a lo suyo', () => {
    for (const rol of [
      UserRole.COMMUNITY_MANAGER, UserRole.DESIGNER, UserRole.AUDIOVISUAL, UserRole.AI_LEAD,
    ]) {
      expect(veSoloLoSuyo(rol), rol).toBe(true);
    }
  });

  it('un cargo desconocido o ausente queda acotado, que es la decisión segura', () => {
    expect(veSoloLoSuyo(undefined)).toBe(true);
    expect(veSoloLoSuyo('rol_que_no_existe')).toBe(true);
  });
});
