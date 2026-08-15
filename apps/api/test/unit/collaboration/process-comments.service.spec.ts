import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProcessCommentsService, ANONYMIZED_BODY } from '../../../src/modules/collaboration/process-comments.service';
import { CommentSubject, CommentVisibility } from '../../../src/modules/collaboration/process-comment.entity';
import { UserRole } from '../../../src/modules/organizations/user-role.enum';

function crear(filas: any[] = []) {
  const store = [...filas];
  const comments = {
    find: vi.fn(async ({ where }: any) => {
      const visibles = where.visibility?._value ?? where.visibility?.value ?? null;
      const ids = where.subjectId?._value ?? where.subjectId?.value ?? null;
      return store.filter((row) => {
        if (Array.isArray(visibles) && !visibles.includes(row.visibility)) return false;
        if (Array.isArray(ids) && !ids.includes(row.subjectId)) return false;
        if (where.subjectId && !Array.isArray(ids) && row.subjectId !== where.subjectId) return false;
        return true;
      });
    }),
    findOne: vi.fn(async ({ where }: any) => store.find((row) => row.id === where.id) ?? null),
    create: (data: any) => data,
    save: vi.fn(async (data: any) => { if (!Array.isArray(data)) store.push(data); return data; }),
  } as any;
  const audit = { log: vi.fn(async () => undefined) } as any;
  return { service: new ProcessCommentsService(comments, audit), store, audit };
}

const equipo = { id: 'u1', role: UserRole.DESIGNER, name: 'Roy' };
const cliente = { id: 'c1', role: UserRole.CLIENT, name: 'Contacto' };

describe('ProcessCommentsService', () => {
  it('congela nombre y cargo del autor al momento de escribir', async () => {
    const { service } = crear();
    const comentario = await service.add('org-1', CommentSubject.PIECE, 'p1', 'Falta el logo', CommentVisibility.INTERNAL, equipo);

    expect(comentario.authorName).toBe('Roy');
    expect(comentario.authorRole).toBe(UserRole.DESIGNER);
    expect(comentario.visibility).toBe(CommentVisibility.INTERNAL);
  });

  it('el cliente nunca ve los comentarios internos', async () => {
    const { service } = crear([
      { id: '1', subjectId: 'p1', visibility: CommentVisibility.INTERNAL, body: 'Nota del equipo', createdAt: new Date() },
      { id: '2', subjectId: 'p1', visibility: CommentVisibility.CLIENT, body: 'Cambiar color', createdAt: new Date() },
    ]);

    const vistaCliente = await service.list('org-1', CommentSubject.PIECE, 'p1', cliente);
    expect(vistaCliente).toHaveLength(1);
    expect(vistaCliente[0].body).toBe('Cambiar color');

    const vistaEquipo = await service.list('org-1', CommentSubject.PIECE, 'p1', equipo);
    expect(vistaEquipo).toHaveLength(2);
  });

  it('separa los dos flujos en vez de intercalarlos', async () => {
    const { service } = crear([
      { id: '1', subjectId: 'p1', visibility: CommentVisibility.INTERNAL, body: 'Interno', createdAt: new Date() },
      { id: '2', subjectId: 'p1', visibility: CommentVisibility.CLIENT, body: 'Del cliente', createdAt: new Date() },
    ]);
    const hilo = await service.thread('org-1', CommentSubject.PIECE, 'p1', equipo);

    expect(hilo.proceso.map((c) => c.body)).toEqual(['Interno']);
    expect(hilo.revision.map((c) => c.body)).toEqual(['Del cliente']);
  });

  it('un comentario del cliente no puede ser interno', async () => {
    const { service } = crear();
    await expect(service.add('org-1', CommentSubject.PIECE, 'p1', 'Hola', CommentVisibility.INTERNAL, cliente))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('solo el autor edita, y la edición deja marca y bitácora', async () => {
    const { service, audit } = crear([{ id: '1', organizationId: 'org-1', authorId: 'u1', body: 'Original' }]);

    await expect(service.edit('org-1', '1', 'Ajeno', { id: 'otro', role: UserRole.ADMIN }))
      .rejects.toBeInstanceOf(ForbiddenException);

    const editado = await service.edit('org-1', '1', 'Corregido', equipo);
    expect(editado.body).toBe('Corregido');
    expect(editado.editedAt).toBeInstanceOf(Date);
    expect(audit.log.mock.calls[0][0].before).toEqual({ body: 'Original' });
  });

  it('no acepta un comentario vacío', async () => {
    const { service } = crear();
    await expect(service.add('org-1', CommentSubject.PIECE, 'p1', '   ', CommentVisibility.INTERNAL, equipo))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('despersonaliza el contenido y conserva la fila y el área', async () => {
    const viejo = new Date(Date.now() - 400 * 86_400_000);
    const { service, store } = crear([
      { id: '1', organizationId: 'org-1', subjectId: 'p1', authorId: 'u1', authorName: 'Roy', authorRole: UserRole.DESIGNER, body: 'Dato sensible', createdAt: viejo, visibility: CommentVisibility.INTERNAL },
    ]);

    expect(await service.anonymizeFor(['p1'], 365)).toBe(1);
    expect(store[0].body).toBe(ANONYMIZED_BODY);
    expect(store[0].authorId).toBeNull();
    expect(store[0].authorName).toBeNull();
    expect(store[0].authorRole).toBe(UserRole.DESIGNER);
    expect(store[0].anonymizedAt).toBeInstanceOf(Date);
  });

  it('un comentario despersonalizado ya no se edita', async () => {
    const { service } = crear([{ id: '1', organizationId: 'org-1', authorId: 'u1', body: ANONYMIZED_BODY, anonymizedAt: new Date() }]);
    await expect(service.edit('org-1', '1', 'Recuperar', equipo)).rejects.toBeInstanceOf(BadRequestException);
  });
});
