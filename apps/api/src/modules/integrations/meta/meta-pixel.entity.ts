import {
  Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * La credencial de un Pixel, con dueño.
 *
 * Sustituye al mapa que vivía dentro de `integrations.config`. Ahí las credenciales de todas las
 * empresas compartían un único campo de una única fila, de modo que cada envío leía el mapa
 * entero, cada cambio lo reescribía bajo un bloqueo que hacía esperar a las demás, y la búsqueda
 * del token era un recorrido cuyo resultado dependía del orden de las claves.
 *
 * La lectura sigue cayendo al JSON cuando no encuentra fila, así que lo configurado antes envía
 * igual mientras dure la convivencia.
 */
@Entity('meta_pixels')
/*
 * Una credencial por Pixel y por dueño.
 *
 * MariaDB no considera iguales dos `NULL` en una clave única, así que esto no impide por sí solo
 * dos filas de registro para el mismo Pixel: eso se defiende al escribir. Lo que sí garantiza es
 * que una empresa no tenga dos credenciales para el mismo destino.
 */
@Index('UQ_meta_pixels_scope', ['organizationId', 'clientId', 'pixelId'], { unique: true })
// La consulta de cada envío: «el token de este Pixel en esta organización».
@Index('IDX_meta_pixels_org_pixel', ['organizationId', 'pixelId'])
export class MetaPixel {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  /**
   * Empresa dueña de esta credencial.
   *
   * Vacío significa **del registro por Pixel**: una credencial declarada para ese destino que no
   * pertenece a ninguna empresa en concreto, y que manda sobre las de empresa cuando existe.
   */
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string | null;

  @Column({ name: 'pixel_id', type: 'varchar', length: 64 }) pixelId: string;

  @Column({ type: 'varchar', length: 255, nullable: true }) name?: string | null;

  /**
   * El token, cifrado con el mismo prefijo `enc:v1:` que el resto de credenciales.
   *
   * Se guarda y se mueve tal cual: descifrarlo para volver a cifrarlo solo añade una forma de
   * estropearlo.
   */
  @Column({ name: 'access_token', type: 'text', nullable: true }) accessToken?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
