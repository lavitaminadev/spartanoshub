import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Qué perfil tiene una persona en una empresa.
 *
 * Una fila por persona y empresa: quien atiende dos locales puede tener un perfil en cada uno.
 * Sin fila, la persona no tiene perfil en esa empresa y lo que se concede es «ninguno».
 */
@Entity('perfil_asignaciones')
@Index('UQ_perfil_asignacion', ['clientId', 'userId'], { unique: true })
@Index('IDX_perfil_asignacion_perfil', ['perfilId'])
export class PerfilAsignacion {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;

  @Column({ name: 'user_id', type: 'uuid' }) userId: string;

  @Column({ name: 'perfil_id', type: 'uuid' }) perfilId: string;

  @Column({ name: 'assigned_by', type: 'uuid', nullable: true }) asignadoPor?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
