import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { AppState } from "../storage/app-state";
import type { SaveError, StateRepository, StorageMode } from "../storage/repository";

interface AppStateContextValue {
  state: AppState;
  storageMode: StorageMode;
  /** Applies a pure update and persists the result. Saves are serialized in call order. */
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

  const update = useCallback(
    (fn: (prev: AppState) => AppState) => {
      const next = fn(latest.current);
      latest.current = next;
      setState(next);
      queue.current = queue.current.then(async () => {
        const res = await repository.save(next);
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
