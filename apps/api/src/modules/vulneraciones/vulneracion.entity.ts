import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Una vulneración de seguridad que afectó datos personales, anotada por una persona.
 *
 * Es un libro de registro: nada se detecta solo. Su valor es la constancia —qué pasó, cuándo se
 * supo, a quién y cuándo se avisó— y que el plazo de aviso al local corra desde `detectedAt`
 * sin depender de que alguien lo recuerde.
 */
@Entity('security_incidents')
@Index('IDX_security_incidents_org_detected', ['organizationId', 'detectedAt'])
export class Vulneracion {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  /** Qué pasó. */
  @Column({ type: 'text' }) descripcion: string;

  /** Cuándo se detectó: de aquí corre el plazo de aviso al local. */
  @Column({ name: 'detected_at', type: 'datetime' }) detectedAt: Date;

  /** Qué datos quedaron expuestos o comprometidos. */
  @Column({ name: 'datos_afectados', type: 'text' }) datosAfectados: string;

  /** De cuántas personas; nulo mientras se desconoce. */
  @Column({ name: 'titulares_afectados', type: 'int', nullable: true }) titularesAfectados?: number | null;

  /** Ids de las empresas atendidas cuyos datos se vieron afectados. */
  @Column({ name: 'client_ids', type: 'json' }) clientIds: string[];

  /** Qué se hizo para contener y reparar. */
  @Column({ type: 'text', nullable: true }) medidas?: string | null;

  /** Cuándo se avisó al local responsable. Nulo mientras no se haya avisado. */
  @Column({ name: 'aviso_local_at', type: 'datetime', nullable: true }) avisoLocalAt?: Date | null;

  /** Cuándo se comunicó a la Agencia de Protección de Datos Personales. */
  @Column({ name: 'aviso_agencia_at', type: 'datetime', nullable: true }) avisoAgenciaAt?: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
