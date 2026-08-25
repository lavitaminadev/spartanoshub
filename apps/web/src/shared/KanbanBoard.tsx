import { useMemo, useState, type CSSProperties, type JSX, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, pointerWithin,
  useDroppable, useSensor, useSensors,
  type CollisionDetection,
  type DragCancelEvent, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';

/** Columna del tablero. El orden del arreglo es el orden en pantalla. */
export interface KanbanColumn {
  id: string;
  label: string;
  /** Color del encabezado. Sin valor usa el neutro del sistema. */
  accent?: string;
}

export interface KanbanBoardProps<T> {
  columns: KanbanColumn[];
  items: T[];
  keyExtractor: (item: T) => string;
  /** Columna a la que pertenece cada tarjeta. */
  columnOf: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  /**
   * Se llama al soltar una tarjeta en otra columna.
   *
   * No se llama al soltarla en la suya: mover algo a donde ya estaba no es un cambio y
   * disparar la mutación igualmente escribiría una transición falsa en el historial.
   */
  onMove: (item: T, toColumnId: string) => void;
  /** Deshabilita el arrastre, para quien solo tiene permiso de lectura. */
  readOnly?: boolean;
  emptyMessage?: string;
  /** Resumen bajo el título de cada columna, por ejemplo el total en dinero. */
  columnSummary?: (columnId: string, items: T[]) => ReactNode;
}

/**
 * Tablero de columnas con arrastre entre ellas.
 *
 * Se apoya en `@dnd-kit`, que ya estaba en el proyecto y en uso en el constructor de
 * formularios. La accesibilidad viene de ahí: el sensor de teclado permite mover una tarjeta
 * sin ratón, que es la parte que un tablero hecho a mano con eventos de arrastre nativos
 * nunca cubre.
 *
 * El componente no sabe de negocio: recibe las columnas, dice a cuál pertenece cada tarjeta y
 * avisa cuando una cambia. Sirve igual para el pipeline comercial que para producción.
 */
export function KanbanBoard<T>({
  columns, items, keyExtractor, columnOf, renderCard, onMove,
  readOnly = false, emptyMessage = 'Sin tarjetas', columnSummary,
}: KanbanBoardProps<T>): JSX.Element {
  const [dragging, setDragging] = useState<T | null>(null);
  const [overlaySize, setOverlaySize] = useState<{ width: number; height: number } | null>(null);

  // El sensor exige recorrer unos píxeles antes de considerar que hay arrastre. Sin ese
  // margen, un clic para abrir el detalle se interpretaba como el comienzo de un arrastre y
  // la tarjeta no se abría nunca.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byColumn = useMemo(() => {
    const grouped = new Map<string, T[]>(columns.map((column) => [column.id, []]));
    for (const item of items) {
      const column = columnOf(item);
      if (grouped.has(column)) grouped.get(column)!.push(item);
    }
    return grouped;
  }, [columns, items, columnOf]);

  /*
   * Con raton interesa la columna que esta realmente bajo el puntero. `closestCorners` puede
   * elegir una columna vecina cuando el tablero tiene scroll horizontal; se conserva como
   * respaldo para el sensor de teclado, que no tiene coordenadas de puntero.
   */
  const collisionDetection: CollisionDetection = (args) => {
    const debajoDelPuntero = pointerWithin(args);
    return debajoDelPuntero.length ? debajoDelPuntero : closestCorners(args);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const item = items.find((candidate) => keyExtractor(candidate) === String(event.active.id));
    setDragging(item ?? null);
    const rect = event.active.rect.current.initial;
    setOverlaySize(rect ? { width: rect.width, height: rect.height } : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    setOverlaySize(null);
    const { active, over } = event;
    if (!over) return;

    const item = items.find((candidate) => keyExtractor(candidate) === String(active.id));
    if (!item) return;

    const destino = String(over.id);
    if (columnOf(item) === destino) return;
    onMove(item, destino);
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setDragging(null);
    setOverlaySize(null);
  };

  const overlayStyle: CSSProperties | undefined = overlaySize
    ? { width: overlaySize.width, height: overlaySize.height }
    : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="kanban-board">
        {columns.map((column) => {
          const columnItems = byColumn.get(column.id) ?? [];
          return (
            <KanbanColumnDropZone key={column.id} column={column} count={columnItems.length}>
              {columnSummary ? <div className="kanban-column-summary">{columnSummary(column.id, columnItems)}</div> : null}
              <div className="kanban-column-body">
                {columnItems.length === 0
                  ? <p className="kanban-empty">{emptyMessage}</p>
                  : columnItems.map((item) => (
                    <KanbanCard
                      key={keyExtractor(item)}
                      id={keyExtractor(item)}
                      disabled={readOnly}
                    >
                      {renderCard(item)}
                    </KanbanCard>
                  ))}
              </div>
            </KanbanColumnDropZone>
          );
        })}
      </div>

      {/* La superposición sigue al puntero mientras se arrastra. Sin ella la tarjeta parece
          quedarse quieta y no se ve qué se está moviendo. */}
      {typeof document !== 'undefined' ? createPortal(
        <DragOverlay dropAnimation={null}>
          {dragging ? (
            <div className="kanban-card is-overlay" style={overlayStyle}>
              {renderCard(dragging)}
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      ) : null}
    </DndContext>
  );
}

function KanbanColumnDropZone({ column, count, children }: { column: KanbanColumn; count: number; children: ReactNode }): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section ref={setNodeRef} className={`kanban-column${isOver ? ' is-over' : ''}`} aria-label={column.label}>
      <header className="kanban-column-header" style={column.accent ? { borderTopColor: column.accent } : undefined}>
        <h3>{column.label}</h3>
        <span className="kanban-count">{count}</span>
      </header>
      {children}
    </section>
  );
}

function KanbanCard({ id, disabled, children }: { id: string; disabled: boolean; children: ReactNode }): JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled });
  return (
    <article
      ref={setNodeRef}
      className={`kanban-card${isDragging ? ' is-dragging' : ''}${disabled ? ' is-static' : ''}`}
      {...attributes}
      {...listeners}
    >
      {children}
    </article>
  );
}
