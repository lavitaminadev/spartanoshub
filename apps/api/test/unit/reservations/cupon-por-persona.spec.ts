import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';

/*
 * Cuántas veces puede usar un cupón la misma persona.
 *
 * Un cupón sólo tenía un total de usos: uno de cien lo podía gastar entero una sola persona.
 */
type Persona = { telefono?: string | null; correo?: string | null; documento?: string | null };

function limite(usosPrevios: number) {
  const manager = { query: vi.fn().mockResolvedValue([{ usos: usosPrevios }]) };
  const servicio = Object.create(ReservationsService.prototype) as unknown as {
    assertUsosPorPersona: (manager: unknown, cupon: unknown, form: unknown, persona: Persona) => Promise<void>;
  };
  const probar = (cupon: Record<string, unknown>, persona: Persona) =>
    servicio.assertUsosPorPersona(manager, { code: 'BIENVENIDA10', ...cupon }, { clientId: 'casa-costanera' }, persona);
  return { probar, manager };
}

const ana = { telefono: '+56911111111', correo: 'ana@correo.cl', documento: '12345678-5' };

describe('límite de un cupón por persona', () => {
  it('sin límite no consulta nada', async () => {
    const { probar, manager } = limite(99);
    await probar({ maxUsesPerPerson: 0 }, ana);
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('deja usarlo mientras no llegue al tope', async () => {
    const { probar } = limite(0);
    await expect(probar({ maxUsesPerPerson: 1, personKeys: ['phone'] }, ana)).resolves.toBeUndefined();
  });

  it('lo rechaza cuando la persona ya lo usó las veces permitidas', async () => {
    const { probar } = limite(1);
    await expect(probar({ maxUsesPerPerson: 1, personKeys: ['phone'] }, ana)).rejects.toThrow(BadRequestException);
  });

  /*
   * Basta con que coincida cualquiera de los datos elegidos: cambiar sólo el correo no sirve
   * para saltarse el límite.
   */
  it('reconoce a la persona por cualquiera de los datos elegidos', async () => {
    const { probar, manager } = limite(0);
    await probar({ maxUsesPerPerson: 2, personKeys: ['phone', 'email', 'document'] }, ana);

    const [sql, valores] = manager.query.mock.calls[0];
    expect(sql).toContain('guest_phone = ? OR guest_email = ? OR guest_document = ?');
    expect(valores).toEqual(['casa-costanera', 'BIENVENIDA10', '+56911111111', 'ana@correo.cl', '12345678-5']);
  });

  it('cuenta sólo en la empresa del cupón, y las canceladas no cuentan', async () => {
    const { probar, manager } = limite(0);
    await probar({ maxUsesPerPerson: 1, personKeys: ['phone'] }, ana);

    const [sql, valores] = manager.query.mock.calls[0];
    expect(sql).toContain('client_id = ?');
    expect(sql).toContain("status NOT LIKE 'cancelled%'");
    expect(valores[0]).toBe('casa-costanera');
  });

  it('usa sólo los datos elegidos, aunque la persona haya dejado otros', async () => {
    const { probar, manager } = limite(0);
    await probar({ maxUsesPerPerson: 1, personKeys: ['document'] }, ana);

    const [sql] = manager.query.mock.calls[0];
    expect(sql).toContain('guest_document = ?');
    expect(sql).not.toContain('guest_phone');
    expect(sql).not.toContain('guest_email');
  });

  it('si la persona no dejó ninguno de los datos elegidos, no se la puede contar', async () => {
    const { probar, manager } = limite(5);
    await expect(probar({ maxUsesPerPerson: 1, personKeys: ['document'] }, { telefono: '+56911111111' })).resolves.toBeUndefined();
    expect(manager.query).not.toHaveBeenCalled();
  });
});
