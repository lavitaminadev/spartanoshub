import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { CommentSubject, CommentVisibility, ProcessComment } from './process-comment.entity';
import { UserRole } from '../organizations/user-role.enum';
import { AuditService } from '../../core/audit/audit.service';

/** Quien escribe, con lo que hace falta congelar en el comentario. */
export interface CommentAuthor {
  id: string;
  role: UserRole;
  name?: string;
}

/** Texto con el que se reemplaza un comentario despersonalizado. */
export const ANONYMIZED_BODY = '[Contenido eliminado por política de retención]';

/**
 * Hilo de trabajo sobre una pieza, una sesión o una solicitud.
 *
 * Dos flujos separados sobre el mismo hilo:
 *
 * - **Interno**: lo que el equipo anota mientras produce. El cliente no lo ve nunca.
 * - **Con el cliente**: lo que se conversa en la revisión, visible en su portal.
 *
 * La separación es de datos y no de presentación: el cliente solo puede leer y escribir en su
 * flujo, y la consulta que arma su vista jamás alcanza los internos. Filtrar al mostrar sería
 * una filtración esperando a que alguien olvide una condición.
 *
 * Nada se borra. Editar deja marca visible y el texto anterior queda en la bitácora: un hilo que
 * se puede reescribir sin rastro no sirve para explicar por qué algo se decidió.
 */
@Injectable()
export class ProcessCommentsService {
  constructor(
    @InjectRepository(ProcessComment) private readonly comments: Repository<ProcessComment>,
    private readonly audit: AuditService,
  ) {}

  /**
   * Hilo cronológico de un trabajo.
   *
   * El cliente recibe solo su flujo. El equipo recibe ambos, porque para trabajar necesita ver
   * lo que el cliente pidió junto a lo que el equipo anotó.
   */
  async list(
    organizationId: string,
    subjectType: CommentSubject,
    subjectId: string,
    viewer: { role: UserRole },
  ): Promise<ProcessComment[]> {
    const visibles = viewer.role === UserRole.CLIENT
      ? [CommentVisibility.CLIENT]
      : [CommentVisibility.INTERNAL, CommentVisibility.CLIENT];

    return this.comments.find({
      where: { organizationId, subjectType, subjectId, visibility: In(visibles) },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Hilo de un trabajo, con los dos flujos separados en vez de intercalados.
   *
   * El hilo pertenece al trabajo: se abre desde el detalle de esa pieza o esa sesión y no existe
   * un muro general donde se mezclen los de todos. Y dentro del detalle los dos flujos van en
   * secciones distintas, no en una sola lista ordenada por fecha: intercalar una observación
   * interna entre dos mensajes del cliente hace que se lean como una conversación única y
   * termina con alguien respondiéndole al cliente algo que era una nota para el equipo.
   *
   * Cada sección va en orden cronológico, que es como se sigue el avance de un trabajo.
   */
  async thread(
    organizationId: string,
    subjectType: CommentSubject,
    subjectId: string,
    viewer: { role: UserRole },
  ): Promise<{ proceso: ProcessComment[]; revision: ProcessComment[] }> {
    const todos = await this.list(organizationId, subjectType, subjectId, viewer);
    return {
      proceso: todos.filter((row) => row.visibility === CommentVisibility.INTERNAL),
      revision: todos.filter((row) => row.visibility === CommentVisibility.CLIENT),
    };
  }

  /**
   * Agrega un comentario al hilo.
   *
   * El cliente solo puede escribir en su propio flujo: dejarlo escribir un comentario interno
   * pondría su texto en una vista que el equipo lee como propia.
   */
  async add(
    organizationId: string,
    subjectType: CommentSubject,
    subjectId: string,
    body: string,
    visibility: CommentVisibility,
    author: CommentAuthor,
  ): Promise<ProcessComment> {
    const texto = body?.trim();
    if (!texto) throw new BadRequestException('El comentario no puede estar vacío');

    const alcance = author.role === UserRole.CLIENT ? CommentVisibility.CLIENT : visibility;
    if (author.role === UserRole.CLIENT && visibility === CommentVisibility.INTERNAL) {
      throw new ForbiddenException('Un comentario del cliente no puede ser interno');
    }

    return this.comments.save(this.comments.create({
      organizationId,
      subjectType,
      subjectId,
      body: texto,
      visibility: alcance,
      authorId: author.id,
      authorRole: author.role,
      authorName: author.name ?? null,
    }));
  }

  /**
   * Corrige un comentario propio.
   *
   * Solo el autor, y solo mientras el comentario no esté despersonalizado. Editar el de otro
   * pondría palabras en su boca en un hilo que se usa para explicar decisiones; por eso ni
   * siquiera la dirección puede hacerlo, y en cambio siempre puede agregar el suyo.
   */
  async edit(organizationId: string, id: string, body: string, author: CommentAuthor): Promise<ProcessComment> {
    const texto = body?.trim();
    if (!texto) throw new BadRequestException('El comentario no puede quedar vacío');

    const comment = await this.comments.findOne({ where: { id, organizationId } });
    if (!comment) throw new NotFoundException('Comentario no encontrado');
    if (comment.anonymizedAt) throw new BadRequestException('Un comentario despersonalizado ya no se edita');
    if (comment.authorId !== author.id) {
      throw new ForbiddenException('Solo el autor edita su comentario. Agrega uno nuevo con tu corrección.');
    }

    const anterior = comment.body;
    comment.body = texto;
    comment.editedAt = new Date();
    const saved = await this.comments.save(comment);

    await this.audit.log({
      organizationId, actorId: author.id, entityType: 'process_comment', entityId: comment.id,
      action: 'edit', before: { body: anterior }, after: { body: texto },
    });
    return saved;
  }

  /**
   * Despersonaliza los comentarios de trabajos cerrados hace más de `retentionDays`.
   *
   * Se conserva la fila y se pierde el contenido: cuántas observaciones tuvo un trabajo, de qué
   * áreas y en qué momentos siguen siendo medibles, y deja de haber dato personal. Borrar la
   * fila cumpliría igual y destruiría la métrica sin necesidad.
   *
   * @param subjectIds - Trabajos ya cerrados cuyo plazo venció, que decide quien llama.
   */
  async anonymizeFor(subjectIds: string[], retentionDays: number, reason = 'Retención cumplida'): Promise<number> {
    if (!subjectIds.length || retentionDays <= 0) return 0;
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);

    const vencidos = await this.comments.find({
      where: { subjectId: In(subjectIds), createdAt: LessThan(cutoff), anonymizedAt: undefined },
    });
    if (!vencidos.length) return 0;

    const ahora = new Date();
    for (const comment of vencidos) {
      comment.body = ANONYMIZED_BODY;
      comment.authorId = null;
      comment.authorName = null;
      // El cargo se conserva: no identifica a nadie y es lo que permite seguir midiendo qué área
      // participó en el trabajo después de que el contenido se fue.
      comment.anonymizedAt = ahora;
    }
    await this.comments.save(vencidos);

    await this.audit.log({
      organizationId: vencidos[0].organizationId, entityType: 'process_comment',
      action: 'anonymize', after: { count: vencidos.length, retentionDays }, reason,
    });
    return vencidos.length;
  }

  /** Cuántas observaciones acumuló un trabajo por flujo, que sobrevive a la despersonalización. */
  async countsFor(organizationId: string, subjectType: CommentSubject, subjectId: string) {
    const rows = await this.comments.find({
      where: { organizationId, subjectType, subjectId },
      select: { visibility: true, anonymizedAt: true },
    });
    return {
      internal: rows.filter((row) => row.visibility === CommentVisibility.INTERNAL).length,
      client: rows.filter((row) => row.visibility === CommentVisibility.CLIENT).length,
      anonymized: rows.filter((row) => row.anonymizedAt).length,
    };
  }
}
