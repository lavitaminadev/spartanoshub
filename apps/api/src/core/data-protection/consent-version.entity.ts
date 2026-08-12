import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Texto versionado del consentimiento informado (Ley 19.628).
 *
 * Guarda el contenido exacto que cada persona aceptó. Sin él, la aceptación registrada en
 * `users.terms_version` es un número que no se puede exhibir ante una consulta del titular.
 *
 * La versión vigente se refleja en el parámetro `compliance.terms_version` como `v{version}`,
 * que es lo que `AuthService.termsPending` compara para decidir si se vuelve a pedir la
 * aceptación: publicar acá sin actualizar ese parámetro dejaría el texto nuevo sin efecto.
 */
@Entity('consent_versions')
@Index('IDX_consent_version_active', ['organizationId', 'active'])
export class ConsentVersion {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', length: 36 }) organizationId: string;

  /** Número correlativo dentro de la organización; es la identidad del texto. */
  @Column({ type: 'int' }) version: number;

  @Column({ length: 200 }) title: string;

  @Column({ type: 'text' }) text: string;

  @CreateDateColumn({ name: 'published_at' }) publishedAt: Date;

  @Column({ name: 'published_by', length: 36, nullable: true }) publishedBy?: string | null;

  /** Solo una versión por organización queda vigente; publicar una nueva retira la anterior. */
  @Column({ type: 'boolean', default: false }) active: boolean;
}
