import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../modules/users/user.entity';

/**
 * Una sesión abierta: un ingreso desde un dispositivo concreto.
 *
 * Antes el refresh token vivía en una columna de `users`, una sola. Eso tenía dos consecuencias
 * que nadie había pedido: entrar desde el teléfono cerraba la sesión del computador, y no había
 * forma de responder «¿dónde está abierta mi cuenta?» ni de cerrar una sola.
 *
 * El access token lleva el identificador de su sesión, así que revocar la fila mata también los
 * access tokens que ya se habían emitido: sin eso, cerrar una sesión no surtía efecto hasta que
 * el token venciera solo.
 *
 * No se borra al cerrarla. Una sesión cerrada es justamente el dato que se quiere mirar cuando
 * se investiga un acceso indebido.
 */
@Entity('user_sessions')
@Index('IDX_user_sessions_user_active', ['userId', 'revokedAt'])
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /**
   * Huella del refresh token vigente de esta sesión.
   *
   * Se guarda el resumen y no el token: quien lea la base no debe poder usar lo que lee. Rota
   * en cada renovación, de modo que un refresh token robado deja de servir en cuanto el
   * legítimo renueva.
   */
  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 64 })
  refreshTokenHash: string;

  /**
   * Momento en que se confirmó la contraseña por última vez.
   *
   * Es lo que hace posible exigir reautenticación en operaciones críticas sin obligar a entrar
   * de nuevo: se compara contra una ventana corta.
   */
  @Column({ name: 'reauthenticated_at', type: 'timestamp', nullable: true })
  reauthenticatedAt?: Date | null;

  /** Para reconocerla en la lista: «Chrome en Windows», no un identificador opaco. */
  @Column({ name: 'user_agent', type: 'varchar', length: 400, nullable: true })
  userAgent?: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'last_seen_at', type: 'timestamp', nullable: true })
  lastSeenAt?: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  /** Cerrada. La fila se conserva: es el dato que se mira al investigar un acceso indebido. */
  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt?: Date | null;

  /** Quién la cerró y por qué: la propia persona, un cambio de contraseña, o un administrador. */
  @Column({ name: 'revoked_reason', type: 'varchar', length: 60, nullable: true })
  revokedReason?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
