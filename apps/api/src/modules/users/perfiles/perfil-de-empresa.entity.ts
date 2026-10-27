import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { JuegoDeAreas, JuegoDeDatos } from '@espartanos/shared';

/**
 * Un juego de áreas con nombre que una empresa reparte entre su gente.
 *
 * Es de la empresa y no del producto: nace de copiar `PERFILES_SUGERIDOS` y desde ahí es suyo.
 * El contenido sólo puede nombrar claves del catálogo `areas.ts`; lo ausente es «ninguno».
 */
@Entity('perfiles')
@Index('UQ_perfil_empresa_nombre', ['clientId', 'nombre'], { unique: true })
export class PerfilDeEmpresa {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;

  @Column({ name: 'name', type: 'varchar', length: 80 }) nombre: string;

  @Column({ name: 'description', type: 'varchar', length: 300, nullable: true }) descripcion?: string | null;

  @Column({ type: 'json' }) areas: JuegoDeAreas;

  @Column({ name: 'protected_data', type: 'json' }) datosProtegidos: JuegoDeDatos;

  @Column({ name: 'created_by', type: 'uuid', nullable: true }) creadoPor?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
