import { describe, expect, it } from 'vitest';
import { veSoloLoSuyo, PERFILES_CRM } from '../../../src/modules/crm/leads/lead-visibility';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

/**
 * El perfil manda sobre el cargo, y su ausencia devuelve la decisión al cargo.
 *
 * El cargo dice a qué módulos se entra; el perfil, cuánto se abarca dentro. Son dos preguntas
 * distintas y la segunda no se puede responder con la primera cuando cada empresa cliente tiene
 * su propia gente: ahí «community manager» no significa nada, y lo que hay es quien lleva el
 * negocio y quien atiende.
 */
describe('perfil de CRM sobre el cargo', () => {
  it('solo hay dos formas de usar el CRM', () => {
    expect([...PERFILES_CRM]).toEqual(['principal', 'venta']);
  });

  it('«venta» ve solo lo suyo, aunque el cargo lo alcance todo', () => {
    expect(veSoloLoSuyo(UserRole.ADMIN, 'venta')).toBe(true);
    expect(veSoloLoSuyo(UserRole.OPERATIONS_DIRECTOR, 'venta')).toBe(true);
  });

  it('«principal» abarca su empresa entera, aunque el cargo no lo hiciera', () => {
    expect(veSoloLoSuyo(UserRole.COMMUNITY_MANAGER, 'principal')).toBe(false);
    expect(veSoloLoSuyo(UserRole.DESIGNER, 'principal')).toBe(false);
  });

  it('sin perfil decide el cargo, que es como funcionaba antes de existir el campo', () => {
    expect(veSoloLoSuyo(UserRole.ADMIN, null)).toBe(false);
    expect(veSoloLoSuyo(UserRole.ADMIN, undefined)).toBe(false);
    expect(veSoloLoSuyo(UserRole.ADMIN, '')).toBe(false);
    expect(veSoloLoSuyo(UserRole.COMMUNITY_MANAGER, null)).toBe(true);
    expect(veSoloLoSuyo(UserRole.COMMUNITY_MANAGER, '')).toBe(true);
  });

  it('un perfil desconocido no concede nada: decide el cargo', () => {
    // Un valor inventado no puede ampliar lo que ve nadie. El DTO ya lo rechaza al escribirlo;
    // esto cubre el dato que pudiera existir en la base de antes o por otra vía.
    expect(veSoloLoSuyo(UserRole.COMMUNITY_MANAGER, 'jefazo')).toBe(true);
    expect(veSoloLoSuyo(UserRole.ADMIN, 'jefazo')).toBe(false);
  });

  it('el cliente sigue viendo todos los leads de su empresa si no se le fija otro perfil', () => {
    expect(veSoloLoSuyo(UserRole.CLIENT, null)).toBe(false);
    // Y su dueño puede acotarlo a «venta» si dentro de la empresa hay quien solo atiende.
    expect(veSoloLoSuyo(UserRole.CLIENT, 'venta')).toBe(true);
  });
});
