import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Una invitación a sumarse al equipo de una empresa, con el perfil elegido en el mismo paso.
 *
 * Se guarda el hash del enlace y no el enlace: quien lea la tabla no puede aceptar por otro.
 * Está pendiente la que no tiene `aceptadaEl` ni `revocadaEl` y no ha vencido.
 */
@Entity('invitaciones_equipo')
@Index('IDX_invitacion_empresa_correo', ['clientId', 'email'])
@Index('UQ_invitacion_token', ['tokenHash'], { unique: true })
export class InvitacionDeEquipo {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;

  @Column({ type: 'varchar', length: 255 }) email: string;

  @Column({ name: 'perfil_id', type: 'uuid' }) perfilId: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 }) tokenHash: string;

  @Column({ name: 'invited_by', type: 'uuid' }) invitadoPor: string;

  @Column({ name: 'expires_at', type: 'timestamp' }) venceEl: Date;

  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true }) aceptadaEl?: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true }) revocadaEl?: Date | null;

  /** Quien administra confirmó, a sabiendas, que esta persona vetada puede volver. */
  @Column({ name: 'lifts_ban', type: 'boolean', default: false }) levantaVeto: boolean;

  /** Por qué se vuelve a invitar a alguien que ya estuvo en esta empresa. */
  @Column({ name: 'reentry_reason', type: 'varchar', length: 300, nullable: true }) motivoReingreso?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
