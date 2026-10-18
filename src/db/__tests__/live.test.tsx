import * as expoSqlite from 'expo-sqlite';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { useDbQuery, withSuppressedInvalidation } from '../live';

/*
 * The live-query contract (#32): a mount reads once unless something changed
 * under it, a re-read that finds the same rows does not re-render, and none of
 * that may cost the header's invariants — no stale data after a write, and a
 * bulk write wakes the screen once.
 *
 * expo-sqlite is native, so its change listener is replaced by one the test
 * drives, and frames are queued by hand so each test decides when they run.
 */

type MockChangeListener = (event: { databaseFilePath: string; tableName: string }) => void;

jest.mock('expo-sqlite', () => {
  const listeners = new Set<MockChangeListener>();
  return {
    addDatabaseChangeListener: (listener: MockChangeListener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    emitChange: (tableName: string) => {
      for (const listener of [...listeners]) listener({ databaseFilePath: '/db/finly.db', tableName });
    },
  };
});

jest.mock('../client', () => ({ db: {}, sqlite: { databasePath: '/db/finly.db' } }));

const emit = (expoSqlite as unknown as { emitChange: (tableName: string) => void }).emitChange;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let frames = new Map<number, () => void>();
let nextFrame = 1;
globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
  const id = nextFrame++;
  frames.set(id, () => callback(0));
  return id;
};
globalThis.cancelAnimationFrame = (id: number | null | undefined) => {
  if (id == null) return;
  frames.delete(id);
};

const flushFrames = () => {
  act(() => {
    const due = [...frames.values()];
    frames = new Map();
    for (const run of due) run();
  });
};

let renders: unknown[];
let renderer: ReactTestRenderer | null;

function Probe({ queryKey, read }: { queryKey: string; read: () => unknown }) {
  const result = useDbQuery(queryKey, ['expenses'], read);
  renders.push(result.error ?? result.data);
  return null;
}

const mount = (read: () => unknown, queryKey = 'k') => {
  act(() => {
    renderer = create(<Probe queryKey={queryKey} read={read} />);
  });
};

beforeEach(() => {
  renders = [];
  renderer = null;
  frames = new Map();
});

afterEach(() => {
  act(() => renderer?.unmount());
});

describe('useDbQuery', () => {
  it('reads once on mount when nothing changed', () => {
    const read = jest.fn(() => [{ id: 'a' }]);
    mount(read);
    flushFrames();

    expect(read).toHaveBeenCalledTimes(1);
    expect(renders).toHaveLength(1);
  });

  it('keeps the same data reference when a re-read finds equal rows', () => {
    const read = jest.fn(() => [{ id: 'a' }]);
    mount(read);
    flushFrames();

    emit('expenses');
    flushFrames();

    expect(read).toHaveBeenCalledTimes(2);
    expect(renders).toHaveLength(1);
  });

  it('re-renders with the new rows when a re-read finds a change', () => {
    let rows = [{ id: 'a' }];
    mount(() => rows);
    flushFrames();

    rows = [{ id: 'a' }, { id: 'b' }];
    emit('expenses');
    flushFrames();

    expect(renders.at(-1)).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('does not read again for a table it does not watch', () => {
    const read = jest.fn(() => [{ id: 'a' }]);
    mount(read);
    flushFrames();

    emit('settings');
    flushFrames();

    expect(read).toHaveBeenCalledTimes(1);
  });

  it('catches a write that lands between the first read and the subscription', () => {
    let rows = [{ id: 'a' }];
    let first = true;
    const read = jest.fn(() => {
      const answer = rows;
      if (first) {
        first = false;
        rows = [{ id: 'a' }, { id: 'b' }];
        emit('expenses');
      }
      return answer;
    });
    mount(read);
    flushFrames();

    expect(read).toHaveBeenCalledTimes(2);
    expect(renders.at(-1)).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('wakes once at the end of a bulk write', async () => {
    const read = jest.fn(() => [{ id: 'a' }]);
    mount(read);
    flushFrames();

    await withSuppressedInvalidation(() => {
      for (let index = 0; index < 100; index += 1) emit('expenses');
    });
    flushFrames();

    expect(read).toHaveBeenCalledTimes(2);
  });

  it('catches up after a bulk write that began before it mounted', async () => {
    let finish = () => {};
    const bulk = withSuppressedInvalidation(
      () => new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    let rows = [{ id: 'a' }];
    mount(() => rows);
    flushFrames();

    rows = [{ id: 'a' }, { id: 'b' }];
    emit('expenses');
    finish();
    await bulk;
    flushFrames();

    expect(renders.at(-1)).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('answers a new key in the same render, even with equal rows', () => {
    const read = jest.fn(() => [{ id: 'a' }]);
    mount(read, 'k1');
    const before = read.mock.calls.length;

    act(() => renderer?.update(<Probe queryKey="k2" read={read} />));

    expect(read.mock.calls.length).toBe(before + 1);
  });

  it('does not re-render a query that keeps failing the same way', () => {
    mount(() => {
      throw new Error('no such table');
    });
    flushFrames();
    const count = renders.length;

    emit('expenses');
    flushFrames();

    expect(renders).toHaveLength(count);
    expect(renders.at(-1)).toEqual(new Error('no such table'));
  });
});
