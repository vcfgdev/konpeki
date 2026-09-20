export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  mergeKey?: string;
};

const historyLimit = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

export function commitHistory<T>(
  history: History<T>,
  present: T,
  mergeKey?: string,
): History<T> {
  if (Object.is(history.present, present)) return history;
  const merging = mergeKey !== undefined && mergeKey === history.mergeKey;
  return {
    past: merging
      ? history.past
      : [...history.past, history.present].slice(-historyLimit),
    present,
    future: [],
    ...(mergeKey ? { mergeKey } : {}),
  };
}

export function finishHistoryEdit<T>(history: History<T>): History<T> {
  return history.mergeKey ? { ...history, mergeKey: undefined } : history;
}

export function undoHistory<T>(history: History<T>): History<T> {
  if (!history.past.length) return finishHistoryEdit(history);
  const present = history.past.at(-1)!;
  return {
    past: history.past.slice(0, -1),
    present,
    future: [history.present, ...history.future],
  };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (!history.future.length) return finishHistoryEdit(history);
  const [present, ...future] = history.future;
  return {
    past: [...history.past, history.present].slice(-historyLimit),
    present,
    future,
  };
}
