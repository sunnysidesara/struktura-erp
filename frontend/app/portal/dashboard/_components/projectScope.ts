"use client";

import { useEffect, useState } from "react";

/**
 * Shared "which project/site am I looking at" store.
 *
 * The header switcher, the sidebar lock state and every project-scoped page
 * read the same module-level state, so picking a project unlocks the sidebar
 * and swaps the data on all pages at once. The choice is remembered per role.
 */

export type ScopeState<T> = {
  items: T[];
  selectedId: number | null;
  loading: boolean;
  error: string;
};

export type ProjectScope<T> = ScopeState<T> & {
  selected: T | null;
  select: (id: number) => void;
  reload: () => void;
};

export function createProjectScope<T>(config: {
  storageKey: string;
  loadItems: () => Promise<T[]>;
  getId: (item: T) => number;
}) {
  const initialState: ScopeState<T> = { items: [], selectedId: null, loading: true, error: "" };

  let state: ScopeState<T> = initialState;
  let started = false;

  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  const remember = (id: number | null) => {
    if (typeof window === "undefined") return;

    if (id === null) {
      window.localStorage.removeItem(config.storageKey);
      return;
    }

    window.localStorage.setItem(config.storageKey, String(id));
  };

  const remembered = (): number | null => {
    if (typeof window === "undefined") return null;

    const parsed = Number.parseInt(window.localStorage.getItem(config.storageKey) ?? "", 10);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const load = (force = false) => {
    if (started && !force) return;

    started = true;
    state = { ...state, loading: true, error: "" };
    emit();

    config
      .loadItems()
      .then((items) => {
        const stored = remembered();
        // No auto-selection: a fresh session starts locked until the user picks
        // a project from the Overview table or the header switcher.
        const valid = items.some((item) => config.getId(item) === stored);
        const selectedId = valid ? stored : null;

        remember(selectedId);
        state = { items, selectedId, loading: false, error: "" };
        emit();
      })
      .catch((err) => {
        state = {
          ...state,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load your projects.",
        };
        emit();
      });
  };

  const select = (id: number) => {
    remember(id);
    state = { ...state, selectedId: id };
    emit();
  };

  /** Forget the selection (used on login so a new session starts locked). */
  const reset = () => {
    remember(null);
    started = false;
    state = { ...initialState, loading: false };
    emit();
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  const getState = () => state;

  /** Subscribe a component to the selection. Pass `enabled` for role gating. */
  const useScope = (enabled = true): ProjectScope<T> => {
    const [snapshot, setSnapshot] = useState<ScopeState<T>>(initialState);

    useEffect(() => {
      if (!enabled) return;

      load();
      setSnapshot(getState());

      return subscribe(() => setSnapshot(getState()));
    }, [enabled]);

    const selected =
      snapshot.items.find((item) => config.getId(item) === snapshot.selectedId) ?? null;

    return { ...snapshot, selected, select, reload: () => load(true) };
  };

  return { load, select, reset, subscribe, getState, useScope };
}
