import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { AppState } from "../storage/app-state";
import type { SaveError, StateRepository, StorageMode } from "../storage/repository";

interface AppStateContextValue {
  state: AppState;
  storageMode: StorageMode;
  /**
   * Applies a pure update and persists the result. Saves run one at a time; updates made while
   * a save is in flight are coalesced into a single save of the latest state.
   */
  update: (fn: (prev: AppState) => AppState) => void;
  saveError: SaveError | null;
  /** FR-021: removes all data on this device and resets to an empty state. */
  wipe: (empty: AppState) => Promise<void>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({
  repository,
  initial,
  children,
}: {
  repository: StateRepository;
  initial: AppState;
  children: ReactNode;
}) {
  const [state, setState] = useState(initial);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const latest = useRef(initial);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const version = useRef(0);
  const savedVersion = useRef(0);

  const update = useCallback(
    (fn: (prev: AppState) => AppState) => {
      const next = fn(latest.current);
      latest.current = next;
      version.current += 1;
      setState(next);
      queue.current = queue.current.then(async () => {
        if (savedVersion.current === version.current) return;
        const target = version.current;
        const res = await repository.save(latest.current);
        savedVersion.current = target;
        setSaveError(res.ok ? null : res.error);
      });
    },
    [repository],
  );

  const wipe = useCallback(
    async (empty: AppState) => {
      await queue.current;
      await repository.wipe();
      latest.current = empty;
      savedVersion.current = version.current;
      setState(empty);
      setSaveError(null);
    },
    [repository],
  );

  return (
    <AppStateContext.Provider
      value={{ state, storageMode: repository.mode, update, saveError, wipe }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
