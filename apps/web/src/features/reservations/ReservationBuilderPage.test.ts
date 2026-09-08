import { describe, expect, it } from 'vitest';
import { builderDragPayload } from './ReservationBuilderPage';

function transfer(values: Record<string, string>) {
  return { dataTransfer: { getData: (type: string) => values[type] || '' } } as never;
}

describe('reservation field drag payload', () => {
  it('supports Safari-compatible text fallback when adding a field', () => {
    expect(builderDragPayload(transfer({ 'text/plain': 'new-field:textarea' }))).toEqual({ newField: 'textarea', fieldId: '' });
  });

  it('reads an existing field identifier for reordering', () => {
    expect(builderDragPayload(transfer({ 'application/x-espartanos-field': 'phone' }))).toEqual({ newField: '', fieldId: 'phone' });
  });
});
