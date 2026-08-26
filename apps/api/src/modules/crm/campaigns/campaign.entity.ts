import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

/** Estado comercial de la campaña. No es su ciclo de vida técnico: lo fija quien la administra. */
export type CampaignStatus = 'active' | 'paused' | 'finished';

/**
 * Una campaña de captación y lo que costó.
 *
 * Existe para poder responder **cuánto cuesta un lead**, que es la única cifra del panel que no
 * se puede deducir de la tabla de leads: los leads dicen de qué campaña vinieron, pero no cuánto
 * se invirtió en ella.
 *
 * El vínculo con los leads es por **nombre** y no por identificador, y es deliberado: el nombre
 * es lo que traen los formularios de Meta y lo que ya se guarda en `leads.campaign_name` desde
 * antes de que esta tabla existiera. Con un identificador habría que reasignar a mano todo el
 * histórico para que el costo por lead dijera algo, y las campañas que siguen llegando por
 * webhook volverían a entrar sin vínculo.
 */
@Entity('crm_campaigns')
@Index('IDX_crm_campaigns_org_name', ['organizationId', 'name'])
export class Campaign {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  /**
   * Cuenta a la que pertenece. Vacío cuando es una campaña de la propia agencia.
   *
   * Es lo que permite que el panel de una empresa muestre solo sus campañas en vez del gasto de
   * todas las cuentas mezclado.
   */
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string | null;

  /** Debe coincidir con `leads.campaign_name` para que el costo por lead pueda calcularse. */
  @Column({ type: 'varchar', length: 180 }) name: string;

  /** De dónde llegan sus leads: el mismo vocabulario que `leads.source`. */
  @Column({ type: 'varchar', length: 50, default: 'Meta Ads' }) source: string;

  @Column({ name: 'starts_at', type: 'date', nullable: true }) startsAt?: Date | null;
  @Column({ name: 'ends_at', type: 'date', nullable: true }) endsAt?: Date | null;

  /**
   * Inversión en la moneda de la organización.
   *
   * `decimal` y no `float`: se divide entre el número de leads para obtener el costo por lead, y
   * el error de la coma flotante se arrastra a esa división.
   */
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 }) investment: number;

  @Column({ type: 'varchar', length: 20, default: 'active' }) status: CampaignStatus;
  /**
   * Pixel propio de esta campaña. Nulo hereda el de la empresa.
   *
   * Dos campañas de la misma empresa pueden anunciar marcas distintas, cada una con su cuenta
   * publicitaria: sin esto, sus conversiones se mezclan en un solo conjunto de datos.
   */
  @Column({ name: 'meta_pixel_id', type: 'varchar', length: 40, nullable: true }) metaPixelId?: string | null;
  /**
   * Si esta campana reporta sus etapas a Meta.
   *
   * Nace encendida: una campana de Meta existe para medirse, y que hubiera que acordarse de
   * activarla dejaria la mayoria sin reportar por olvido. Apagarla es la excepcion —una campana
   * de prueba, o una cuyo Pixel todavia no esta listo— y no obliga a apagar el CRM entero.
   *
   * La capacidad de la empresa sigue mandando: con `metaConversions` apagado no sale nada,
   * aunque esto esté encendido.
   */
  @Column({ name: 'meta_capi_enabled', type: 'boolean', default: true }) metaCapiEnabled: boolean;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
