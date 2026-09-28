import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { asegurarQueAdministraLaEmpresa } from '../../../src/modules/clients/datos-legales-de-empresa';

/*
 * Guardar los datos legales de una empresa, y aceptar el encargo de tratamiento en su nombre, es
 * de quien la administra. Cualquier cuenta de la empresa podía hacerlo, con sólo lectura en
 * Encuestas.
 */
const permisos = (administra: boolean) => ({ can: vi.fn().mockResolvedValue(administra) });

describe('datos legales de la empresa', () => {
  it('quien administra la empresa los guarda', async () => {
    const p = permisos(true);
    await expect(asegurarQueAdministraLaEmpresa(p, 'org-1', { id: 'ana', role: 'client' }, 'c-1')).resolves.toBeUndefined();
    expect(p.can).toHaveBeenCalledWith('org-1', 'ana', 'client', 'users', 'manage', 'c-1');
  });

  it('el resto de su equipo no', async () => {
    await expect(asegurarQueAdministraLaEmpresa(permisos(false), 'org-1', { id: 'rocio', role: 'client' }, 'c-1'))
      .rejects.toThrow(ForbiddenException);
  });

  it('el equipo de Espartanos no pasa por esta reja: su acceso se comprueba por empresa', async () => {
    const p = permisos(false);
    await expect(asegurarQueAdministraLaEmpresa(p, 'org-1', { id: 'cd', role: 'commercial_director' }, 'c-1')).resolves.toBeUndefined();
    expect(p.can).not.toHaveBeenCalled();
  });
});
