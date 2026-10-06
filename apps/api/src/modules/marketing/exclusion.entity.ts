import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Quién pidió no recibir más correo comercial, sin guardar quién es.
 *
 * El artículo 28 B de la Ley 19.496 dice que, pedida la suspensión, los envíos siguientes
 * «quedarán desde entonces prohibidos». Cumplir esa prohibición exige recordar la petición, y
 * recordarla exige conservar algo. Pero la Ley 21.719 da además derecho a que le borren sus datos,
 * y las dos cosas parecen incompatibles: si se borra la dirección, no hay cómo saber que pidió no
 * recibir.
 *
 * Se resuelve guardando una **huella** de la dirección y no la dirección. La huella se calcula
 * hacia un solo lado: teniéndola nadie puede reconstruir el correo, así que sus datos sí quedan
 * borrados. Pero cuando llega una dirección nueva se calcula su huella y se compara, y la
 * prohibición se sigue respetando.
 *
 * Es también lo que hace que el botón «darme de baja de todos» signifique algo: sin esta lista,
 * bastaba con que reservara en un local nuevo para que se le creara otra ficha y volviera a
 * recibir, y el botón habría prometido algo que el sistema no cumplía.
 */
@Entity('email_suppression')
@Index('UQ_email_suppression_org_huella_client', ['organizationId', 'huella', 'clientId'], { unique: true })
@Index('IDX_email_suppression_org_huella', ['organizationId', 'huella'])
export class ExclusionDeCorreo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  /**
   * Empresa de la que se dio de baja. Nulo significa **todas**, incluida la agencia.
   *
   * La baja de un local no alcanza a los demás: cada empresa es responsable distinto de esos
   * datos y el permiso se le dio a cada una por separado.
   */
  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId?: string | null;

  /** Huella del correo en minúsculas. No se guarda la dirección: de la huella no se vuelve. */
  @Column({ type: 'char', length: 64 })
  huella: string;

  /** `local` o `todas`, para saber qué se pidió sin interpretarlo desde el `clientId`. */
  @Column({ type: 'varchar', length: 10 })
  alcance: 'local' | 'todas';

  /** Desde qué correo se pidió, para poder reconstruir el caso ante un reclamo. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  origen?: string | null;

  /**
   * Día en que **la persona** pidió la baja, cuando no es el día en que se anotó.
   *
   * Hacen falta las dos fechas y no son la misma. `created_at` dice cuándo lo aplicamos nosotros,
   * que es lo que demuestra diligencia. Ésta dice desde cuándo el envío estaba prohibido, que es
   * otra cosa: el aviso del SERNAC llega el día hábil siguiente a la solicitud, y si la persona lo
   * pidió además por teléfono rige la primera de las dos fechas. Nula significa que coincide con
   * `created_at`.
   */
  @Column({ name: 'pedida_el', type: 'datetime', nullable: true })
  pedidaEl?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
