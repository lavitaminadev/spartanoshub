import { describe, expect, it } from 'vitest';
import { ACTION_DESTINATIONS, destinationFor } from './action-destinations';

describe('destinos después de una acción', () => {
  it('lo que crea lleva a lo creado y lo deja destacado', () => {
    expect(destinationFor('request.converted', { createdIds: ['p1', 'p2'] }))
      .toBe('/production?highlight=p1,p2');
    expect(destinationFor('piece.created', { createdIds: ['p9'] })).toBe('/production?highlight=p9');
  });

  it('una conversión de audiovisual no aterriza en el tablero de arte', () => {
    expect(destinationFor('request.converted', { createdIds: ['s1'], area: 'audiovisual' }))
      .toBe('/audiovisual?highlight=s1');
  });

  it('lo que cierra devuelve a la lista', () => {
    expect(destinationFor('request.rejected')).toBe('/intake');
    expect(destinationFor('pieceType.retired')).toBe('/settings/piece-types');
  });

  it('lo que no cambia de contexto se queda donde está', () => {
    expect(destinationFor('piece.assigned')).toBeNull();
    expect(destinationFor('comment.added')).toBeNull();
    expect(destinationFor('settings.saved')).toBeNull();
  });

  it('sin identificadores no arma un resaltado vacío', () => {
    expect(destinationFor('piece.created', {})).toBe('/production');
    expect(destinationFor('piece.created', { createdIds: [] })).toBe('/production');
  });

  it('una acción no declarada se queda donde está en vez de romper', () => {
    expect(destinationFor('accion.inventada' as never)).toBeNull();
  });

  it('toda acción declarada resuelve sin lanzar', () => {
    for (const action of Object.keys(ACTION_DESTINATIONS)) {
      expect(() => destinationFor(action as never, { createdIds: ['x'], subjectId: 'x' })).not.toThrow();
    }
  });
});
