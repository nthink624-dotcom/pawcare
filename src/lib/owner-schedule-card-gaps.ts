export type ScheduleCardTiming = {
  id: string;
  startMinutes: number;
  endMinutes: number;
  column: number;
};

export type ScheduleCardEdgeInset = {
  top: number;
  bottom: number;
};

const TOUCHING_EDGE_INSET = 2;

/**
 * Keeps the appointment's time geometry and hit area intact. Only two cards
 * that meet in the same collision column receive a quiet visual separation.
 */
export function getAdjacentScheduleCardEdgeInsets(items: ScheduleCardTiming[]) {
  const insets = new Map<string, ScheduleCardEdgeInset>(
    items.map((item) => [item.id, { top: 0, bottom: 0 }]),
  );
  const ordered = [...items].sort((left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes);

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    if (current.column !== next.column || current.endMinutes !== next.startMinutes) continue;
    const currentInset = insets.get(current.id) ?? { top: 0, bottom: 0 };
    const nextInset = insets.get(next.id) ?? { top: 0, bottom: 0 };
    insets.set(current.id, { top: currentInset.top, bottom: TOUCHING_EDGE_INSET });
    insets.set(next.id, { top: TOUCHING_EDGE_INSET, bottom: nextInset.bottom });
  }

  return insets;
}
