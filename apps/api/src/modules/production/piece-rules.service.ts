import { Injectable } from '@nestjs/common';
import { ParameterResolver } from '../../core/parameters/parameter-resolver.service';

@Injectable()
export class PieceRulesService {
  private readonly defaultMaxCorrections = 3;

  constructor(private readonly parameters?: ParameterResolver) {}

  async canRequestCorrection(
    currentCount: number,
    isDesignerError: boolean,
    organizationId?: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const maxCorrections = await this.resolveMaxCorrections(organizationId);
    if (!isDesignerError && currentCount >= maxCorrections) {
      return { allowed: true, reason: `La corrección supera las ${maxCorrections} rondas incluidas y será cobrable.` };
    }
    return { allowed: true };
  }

  /**
   * Si una ronda de correcciones del cliente pasa a ser cobrable.
   *
   * **Es la única fuente de esta decisión.** Antes vivía en tres sitios y dos de ellos
   * comparaban contra un 3 escrito a mano, así que subir el límite configurado dejaba la
   * pantalla de producción marcando como cobrable algo que la aprobación consideraba incluido.
   */
  async shouldGenerateInvoice(clientCorrectionCount: number, organizationId?: string): Promise<boolean> {
    return clientCorrectionCount > await this.resolveMaxCorrections(organizationId);
  }

  /**
   * Rondas incluidas, para poder mostrarlas junto al contador.
   *
   * Sin este dato la pantalla decía «4 correcciones» sin decir sobre cuántas, que es la mitad
   * de la información.
   */
  async maxCorrections(organizationId?: string): Promise<number> {
    return this.resolveMaxCorrections(organizationId);
  }

  private async resolveMaxCorrections(organizationId?: string): Promise<number> {
    if (!this.parameters || !organizationId) return this.defaultMaxCorrections;
    const configured = await this.parameters.get('production.max_client_corrections', null, null, organizationId);
    return Number(configured ?? this.defaultMaxCorrections);
  }
}
