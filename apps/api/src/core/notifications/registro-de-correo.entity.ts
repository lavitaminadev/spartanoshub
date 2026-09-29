import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Un correo que la plataforma intentó enviar.
 *
 * El servidor de correo no guarda copia en «Enviados» y cPanel borra su historial a los diez
 * días, así que no había forma de saber qué salió ni a quién. Se guarda el destinatario, el
 * asunto y el resultado; **nunca el cuerpo**, que es donde van los teléfonos y correos de los
 * clientes finales. Se borra solo a los 90 días. Lo lee únicamente el cargo de desarrollo.
 */
@Entity('registro_de_correos')
@Index('IDX_registro_de_correos_fecha', ['createdAt'])
export class RegistroDeCorreo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 320 })
  destinatario: string;

  @Column({ type: 'varchar', length: 255 })
  asunto: string;

  /** `enviado`: el servidor de correo lo aceptó. `rechazado`: lo rechazó. `fallido`: error al enviar. `omitido`: no se intentó. */
  @Column({ type: 'varchar', length: 12 })
  resultado: 'enviado' | 'rechazado' | 'fallido' | 'omitido';

  /** Por qué no salió, en una línea. Vacío si salió. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
