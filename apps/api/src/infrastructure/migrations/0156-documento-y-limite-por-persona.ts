import { MigrationInterface, QueryRunner } from 'typeorm';
import { leerDocumento } from '@espartanos/shared';
import { fechaDeNacimientoValida } from '../../modules/reservations/application/fecha-de-nacimiento';
import { hayColumna, hayIndice } from './helpers/catalogo';

/**
 * Documento de identidad en la reserva, límite de un cupón por persona, y las fechas de nacimiento
 * que se perdían.
 *
 * **Documento.** El RUT vivía sólo dentro de las respuestas del formulario y como la persona lo
 * escribió, con o sin puntos. Para saber si dos reservas son de la misma persona hay que poder
 * compararlo, así que va normalizado en columnas propias, junto con el pasaporte de quien no
 * tiene RUT.
 *
 * **Límite por persona.** Un cupón sólo tenía un total de usos: uno de cien usos lo podía gastar
 * entero una sola persona.
 *
 * **Relleno de lo que ya existe.** Las reservas anteriores tienen el RUT y la fecha de nacimiento
 * dentro de sus respuestas. Se copian a sus columnas para que el límite del cupón cuente también
 * lo de antes y el saludo de cumpleaños encuentre las fechas: la reserva pública pedía la fecha
 * pero nunca la guardaba en su columna, así que ninguna llegaba a la lista de suscriptores.
 *
 * El relleno sólo escribe columnas vacías y nunca borra nada: correrla dos veces no cambia el
 * resultado.
 */
export class DocumentoYLimitePorPersona1790000000156 implements MigrationInterface {
  name = 'DocumentoYLimitePorPersona1790000000156';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('reservations')) {
      if (!(await hayColumna(queryRunner, 'reservations', 'guest_document_type'))) {
        await queryRunner.query('ALTER TABLE reservations ADD COLUMN guest_document_type VARCHAR(12) NULL');
      }
      if (!(await hayColumna(queryRunner, 'reservations', 'guest_document_country'))) {
        await queryRunner.query('ALTER TABLE reservations ADD COLUMN guest_document_country CHAR(2) NULL');
      }
      if (!(await hayColumna(queryRunner, 'reservations', 'guest_document'))) {
        await queryRunner.query('ALTER TABLE reservations ADD COLUMN guest_document VARCHAR(40) NULL');
      }
      // El conteo del límite pregunta por empresa y cupón, y después filtra por persona.
      if (!(await hayIndice(queryRunner, 'reservations', 'IDX_reservations_cupon_por_persona'))) {
        await queryRunner.query('CREATE INDEX IDX_reservations_cupon_por_persona ON reservations (client_id, coupon_code)');
      }
    }

    if (await queryRunner.hasTable('reservation_coupons')) {
      if (!(await hayColumna(queryRunner, 'reservation_coupons', 'max_uses_per_person'))) {
        await queryRunner.query('ALTER TABLE reservation_coupons ADD COLUMN max_uses_per_person INT NOT NULL DEFAULT 0');
      }
      if (!(await hayColumna(queryRunner, 'reservation_coupons', 'person_keys'))) {
        await queryRunner.query('ALTER TABLE reservation_coupons ADD COLUMN person_keys JSON NULL');
      }
    }

    await this.rellenarDesdeLasRespuestas(queryRunner);
  }

  /**
   * Copia a sus columnas el documento y la fecha de nacimiento que ya estaban en las respuestas.
   *
   * Se recorre formulario por formulario, porque el id del campo que guarda cada dato es distinto
   * en cada uno. Sólo se tocan las reservas cuya columna sigue vacía.
   */
  private async rellenarDesdeLasRespuestas(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservation_forms')) || !(await queryRunner.hasTable('reservations'))) return;
    const formularios = await queryRunner.query('SELECT id, field_schema FROM reservation_forms') as Array<{ id: string; field_schema: unknown }>;

    for (const formulario of formularios) {
      const esquema = leerJson(formulario.field_schema);
      if (!Array.isArray(esquema)) continue;
      const campos = esquema as Array<{ id?: string; type?: string }>;
      const campoDocumento = campos.find((campo) => campo.type === 'document' || campo.type === 'rut')?.id;
      const campoNacimiento = campos.find((campo) => campo.type === 'birthdate')?.id;
      if (!campoDocumento && !campoNacimiento) continue;

      const reservas = await queryRunner.query(
        'SELECT id, answers, guest_document, birth_date FROM reservations WHERE form_id = ? AND (guest_document IS NULL OR birth_date IS NULL)',
        [formulario.id],
      ) as Array<{ id: string; answers: unknown; guest_document: string | null; birth_date: string | null }>;

      for (const reserva of reservas) {
        const respuestas = leerJson(reserva.answers) as Record<string, unknown> | null;
        if (!respuestas) continue;

        if (campoDocumento && !reserva.guest_document) {
          const documento = leerDocumento(respuestas[campoDocumento]);
          if (documento) {
            await queryRunner.query(
              'UPDATE reservations SET guest_document_type = ?, guest_document_country = ?, guest_document = ? WHERE id = ? AND guest_document IS NULL',
              [documento.tipo, documento.pais, documento.numero, reserva.id],
            );
          }
        }

        if (campoNacimiento && !reserva.birth_date) {
          const fecha = respuestas[campoNacimiento];
          if (typeof fecha === 'string' && fechaDeNacimientoValida(fecha)) {
            await queryRunner.query(
              'UPDATE reservations SET birth_date = ? WHERE id = ? AND birth_date IS NULL',
              [fecha.slice(0, 10), reserva.id],
            );
          }
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Las fechas de nacimiento rellenadas se quedan: eran de las propias respuestas y quitarlas
    // volvería a dejar al saludo de cumpleaños sin datos.
    if (await queryRunner.hasTable('reservation_coupons')) {
      if (await hayColumna(queryRunner, 'reservation_coupons', 'person_keys')) await queryRunner.query('ALTER TABLE reservation_coupons DROP COLUMN person_keys');
      if (await hayColumna(queryRunner, 'reservation_coupons', 'max_uses_per_person')) await queryRunner.query('ALTER TABLE reservation_coupons DROP COLUMN max_uses_per_person');
    }
    if (await queryRunner.hasTable('reservations')) {
      if (await hayIndice(queryRunner, 'reservations', 'IDX_reservations_cupon_por_persona')) await queryRunner.query('DROP INDEX IDX_reservations_cupon_por_persona ON reservations');
      for (const columna of ['guest_document', 'guest_document_country', 'guest_document_type']) {
        if (await hayColumna(queryRunner, 'reservations', columna)) await queryRunner.query(`ALTER TABLE reservations DROP COLUMN ${columna}`);
      }
    }
  }
}

/** Un JSON que puede llegar ya leído o como texto, según el driver. */
function leerJson(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor ?? null;
  try { return JSON.parse(valor); } catch { return null; }
}
