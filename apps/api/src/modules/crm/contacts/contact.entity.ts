import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Organization } from '../../organizations/organization.entity';
import { Lead } from '../leads/lead.entity';

/**
 * Vínculo de una persona con una cuenta. **No es un segundo registro de la persona.**
 *
 * El reparto es este y no admite excepciones:
 *
 * | | `leads` | `crm_contacts` |
 * |---|---|---|
 * | Quién es | nombre, correo, teléfono, empresa | — |
 * | Su ciclo | estado, etiquetas, puntaje, consentimiento, retención | — |
 * | Con qué cuenta se relaciona | — | `client_id` |
 * | Su papel en esa relación | — | `position`, `notes` |
 *
 * Convivían como si fueran dos registros de la misma persona, con la identidad escribible en
 * los dos lados. Eso hacía posible que el correo del lead y el del contacto divergieran sin que
 * nada lo detectara, y que la pantalla mostrara uno mientras las conversiones usaban el otro.
 * La identidad ahora vive en un solo lugar y acá solo queda el vínculo.
 *
 * Un contacto siempre nace de un lead —lo crea la automatización de captura, nunca una
 * persona—, así que `lead_id` es obligatorio. Sin esa regla se podían crear contactos flotantes
 * que ninguna pantalla mostraba y que ningún proceso mantenía al día.
 */
@Entity('crm_contacts')
@Index('IDX_crm_contacts_org_client_created', ['organizationId', 'clientId', 'createdAt'])
export class Contact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;

  /** Persona a la que pertenece este vínculo. Obligatorio: no existen contactos sin lead. */
  @Column({ name: 'lead_id', type: 'uuid' }) leadId: string;
  @ManyToOne(() => Lead) @JoinColumn({ name: 'lead_id' }) lead?: Lead;

  /**
   * Cuenta a la que pertenece el contacto.
   *
   * Separa la audiencia de cada local: dos restaurantes con el mismo comensal tienen dos
   * contactos, y ninguno ve el del otro. Queda en null para los contactos comerciales, que
   * pertenecen a una empresa prospecto y no a un cliente.
   */
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string;

  /**
   * Copia del nombre al momento de crear el vínculo.
   *
   * Se conserva por comodidad de lectura, pero **la fuente es el lead**: se sincroniza desde
   * ahí y no se edita por separado. Editarlo acá era lo que permitía que los dos registros
   * dijeran cosas distintas de la misma persona.
   */
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) email?: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) phone?: string | null;

  /** Papel de la persona dentro de la cuenta. Esto sí es propio del vínculo. */
  @Column({ type: 'varchar', length: 255, nullable: true }) position?: string;
  @Column({ type: 'text', nullable: true }) notes?: string;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
