import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsentVersion } from '../../core/data-protection/consent-version.entity';
import { DataConsent } from '../../core/data-protection/consent.entity';
import { AuditService } from '../../core/audit/audit.service';
import { UserRole } from '../organizations/user-role.enum';

/** Subir al cambiar el texto: cada aceptación queda ligada a la versión que se leyó. */
export const VERSION_DEL_TEXTO_DE_DETALLE_DE_CONTACTO = 1;

export const TITULO_DEL_TEXTO_DE_DETALLE_DE_CONTACTO = `Detalle de contacto en avisos de grupo (v${VERSION_DEL_TEXTO_DE_DETALLE_DE_CONTACTO})`;

export const TEXTO_DE_DETALLE_DE_CONTACTO =
  'Autorizo que el aviso por correo de solicitud de grupo de esta empresa incluya el teléfono y el '
  + 'correo de quien pidió el evento, solo para destinatarios que son cuentas con acceso directo a '
  + 'los datos del comensal. Entiendo que un correo no deja constancia de quién lo leyó, que puede '
  + 'reenviarse y que queda en bandejas externas; que las alergias y las respuestas del formulario '
  + 'no se envían nunca por correo; y que la agencia lo hace como encargada del tratamiento por '
  + 'cuenta de la empresa. Puedo retirar esta autorización en cualquier momento.';

/** Quién puede encender la capacidad: la agencia comercial, más administración y desarrollo. */
const PUEDEN_ENCENDER: readonly string[] = [UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN, UserRole.DEV];

export const ACCION_DETALLE_DE_CONTACTO = 'detalle_contacto_avisos';

/**
 * Encender y apagar `detalleDeContactoEnAvisos` con constancia.
 *
 * Encender exige el cargo adecuado y aceptar el texto vigente; apagar solo deja constancia.
 * Ambos movimientos quedan en `DataConsent` (quién, cuándo, desde qué IP) y en la auditoría.
 */
@Injectable()
export class DetalleDeContactoEnAvisosService {
  constructor(
    @InjectRepository(ConsentVersion) private readonly textos: Repository<ConsentVersion>,
    @InjectRepository(DataConsent) private readonly consentimientos: Repository<DataConsent>,
    private readonly audit: AuditService,
  ) {}

  /** El texto vigente, con el id que la pantalla devuelve al aceptarlo. */
  async texto(organizationId: string): Promise<{ id: string; version: number; titulo: string; texto: string }> {
    let fila = await this.textos.findOne({ where: { organizationId, title: TITULO_DEL_TEXTO_DE_DETALLE_DE_CONTACTO } });
    if (!fila) {
      const ultima = await this.textos.findOne({ where: { organizationId }, order: { version: 'DESC' } });
      // `active: false`: es un texto de autorización, no los términos de uso que se piden al entrar.
      fila = await this.textos.save(this.textos.create({
        organizationId,
        version: (ultima?.version ?? 0) + 1,
        title: TITULO_DEL_TEXTO_DE_DETALLE_DE_CONTACTO,
        text: TEXTO_DE_DETALLE_DE_CONTACTO,
        active: false,
      }));
    }
    return { id: fila.id, version: fila.version, titulo: fila.title, texto: fila.text };
  }

  puedeEncender(rol: string): boolean {
    return PUEDEN_ENCENDER.includes(rol);
  }

  /**
   * Valida y registra el cambio de la capacidad.
   *
   * @throws ForbiddenException si quien enciende no tiene el cargo, o no aceptó el texto vigente.
   */
  async registrarCambio(ctx: {
    organizationId: string; clientId: string; actorId: string; rol: string; ip?: string;
    encender: boolean; aceptacion?: string;
  }): Promise<void> {
    let versionAceptada: number | null = null;
    if (ctx.encender) {
      if (!this.puedeEncender(ctx.rol)) {
        throw new ForbiddenException('Sólo dirección comercial, administración o desarrollo pueden encender el detalle de contacto en los avisos');
      }
      const texto = await this.texto(ctx.organizationId);
      if (!ctx.aceptacion || ctx.aceptacion !== texto.id) {
        throw new ForbiddenException({
          message: 'Para encender el detalle de contacto en los avisos hay que aceptar el texto vigente',
          requiereAceptacion: true,
        });
      }
      versionAceptada = texto.version;
    }
    await this.consentimientos.save(this.consentimientos.create({
      userId: ctx.actorId,
      action: `${ACCION_DETALLE_DE_CONTACTO}:${ctx.clientId}:${ctx.encender ? `aceptado:v${versionAceptada}` : 'retirado'}`,
      granted: ctx.encender,
      ipAddress: ctx.ip ?? null,
    }));
    await this.audit.log({
      organizationId: ctx.organizationId,
      actorId: ctx.actorId,
      entityType: 'Client',
      entityId: ctx.clientId,
      action: ctx.encender ? 'detalle_contacto_avisos_encendido' : 'detalle_contacto_avisos_apagado',
      after: { detalleDeContactoEnAvisos: ctx.encender, versionDelTexto: versionAceptada },
      ipAddress: ctx.ip,
    });
  }
}
