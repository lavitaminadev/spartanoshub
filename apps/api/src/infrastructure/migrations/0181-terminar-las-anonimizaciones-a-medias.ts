import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * Las reservas que ya figuran anonimizadas quedan anonimizadas de verdad.
 *
 * `anonymizeReservation` borraba el nombre, el contacto, las respuestas y las cookies de Meta, y
 * dejaba intactos el documento de identidad, la fecha de nacimiento y los identificadores de clic.
 * Un RUT identifica a una persona por sí solo, así que esas filas seguían siendo reidentificables
 * y el plazo de conservación que publica la política de privacidad no se cumplía sobre ellas.
 *
 * El servicio ya no las deja atrás; esta migración alcanza a las que se procesaron antes.
 *
 * **Sólo toca filas que el propio proceso marcó como anonimizadas**, reconocibles por el nombre
 * que les escribe (`Visitante anonimizado …`). Una reserva viva no se toca: su documento y su
 * fecha de nacimiento siguen haciendo falta mientras la finalidad esté vigente.
 *
 * Los textos de consentimiento se conservan: son la constancia de la autorización, guardan la
 * cláusula y su versión, y no contienen datos de la persona.
 *
 * Correrla dos veces no cambia el resultado, y por eso no tiene vuelta atrás: el dato que borra
 * ya no existe en ninguna parte desde donde reponerlo.
 */
export class TerminarLasAnonimizacionesAMedias1790000000181 implements MigrationInterface {
  name = 'TerminarLasAnonimizacionesAMedias1790000000181';

  /** Columnas que se vacían, sólo si existen: una base antigua puede no tenerlas todas. */
  private static readonly COLUMNAS = [
    'birth_date',
    'guest_document',
    'guest_document_type',
    'guest_document_country',
    'fbclid',
    'gclid',
    'gbraid',
    'wbraid',
    'click_id',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservations'))) return;

    const presentes: string[] = [];
    for (const columna of TerminarLasAnonimizacionesAMedias1790000000181.COLUMNAS) {
      if (await hayColumna(queryRunner, 'reservations', columna)) presentes.push(columna);
    }
    if (!presentes.length) return;

    const asignaciones = presentes.map((columna) => `${columna} = NULL`).join(', ');
    const pendientes = presentes.map((columna) => `${columna} IS NOT NULL`).join(' OR ');

    /*
     * En tandas, y no de una vez: la tabla de reservas es de las grandes y un UPDATE sin tope
     * mantendría el bloqueo durante todo el despliegue. El bucle termina cuando una pasada ya no
     * encuentra nada que limpiar.
     */
    for (;;) {
      const resultado = await queryRunner.query(
        `UPDATE reservations SET ${asignaciones}`
        + " WHERE guest_name LIKE 'Visitante anonimizado %'"
        + ` AND (${pendientes}) LIMIT 2000`,
      ) as { affectedRows?: number };
      if (!resultado?.affectedRows) return;
    }
  }

  /** Sin vuelta atrás: los datos que borra no se pueden reponer. */
  public async down(): Promise<void> {
    return undefined;
  }
}
