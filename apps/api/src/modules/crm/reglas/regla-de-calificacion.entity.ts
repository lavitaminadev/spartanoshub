import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { Acciones, Condicion } from './evaluar-reglas';

/**
 * Una regla de calificación: qué mirar de un lead y qué hacer con él.
 *
 * Pertenece a una empresa. No hay reglas «de todas»: calificar es la decisión más propia de cada
 * negocio —lo que para una inmobiliaria es un buen lead, para un restaurante no significa nada—
 * y una regla heredada calificaría solas empresas que nadie revisó. Para no reescribirlas está
 * copiarlas de otra empresa, que es un acto voluntario y deja reglas propias que se pueden
 * editar sin afectar al original.
 *
 * Borrar no existe: se archiva. Una regla que calificó leads es la explicación de por qué esos
 * leads están como están, y borrarla dejaría el historial diciendo «regla eliminada».
 */
@Entity('crm_reglas_de_calificacion')
@Index('IDX_crm_reglas_org_client', ['organizationId', 'clientId', 'archivedAt'])
export class ReglaDeCalificacion {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  /** Empresa dueña de la regla. Siempre tiene una. */
  @Column({ name: 'client_id', type: 'varchar', length: 36 }) clientId: string;

  @Column({ type: 'varchar', length: 120 }) nombre: string;

  /**
   * El orden en que se prueban. Manda la primera que calza.
   *
   * Es la única forma de resolver reglas que se contradicen, y se resuelve donde se ve: la
   * lista que el equipo ordena.
   */
  @Column({ type: 'int', default: 0 }) posicion: number;

  /** Apagada sigue existiendo y se puede volver a encender. Es lo contrario de archivar. */
  @Column({ type: 'boolean', default: true }) activa: boolean;

  /**
   * `false` mientras se prueba: la regla solo corre cuando alguien la aplica a mano.
   *
   * Nace así a propósito. Activarla de entrada significaría que el primer error se descubre con
   * cien leads mal calificados.
   */
  @Column({ type: 'boolean', default: false }) automatica: boolean;

  /** `todas` exige que se cumplan todas las condiciones; `alguna`, que se cumpla una. */
  @Column({ type: 'varchar', length: 10, default: 'todas' }) unir: 'todas' | 'alguna';

  /*
   * Condiciones y acciones van en JSON y no en tablas aparte.
   *
   * Se leen y se escriben siempre juntas con su regla —nunca se consulta «todas las condiciones
   * de la organización»— y su forma cambia cuando se agrega un comparador o una acción. En
   * tablas, cada cambio sería una migración y tres consultas para armar una regla.
   */
  @Column({ type: 'json', nullable: true }) condiciones?: Condicion[] | null;

  @Column({ type: 'json', nullable: true }) acciones?: Acciones | null;

  /** Quién la creó, para poder preguntarle cuando alguien no entienda por qué existe. */
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string | null;

  @Column({ name: 'archived_at', type: 'timestamp', nullable: true }) archivedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
