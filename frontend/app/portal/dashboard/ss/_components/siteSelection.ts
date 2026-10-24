"use client";

import { useEffect, useState } from "react";
import { getSsSites, type SsSiteOption } from "@/lib/api";

/**
 * Global "which site is the supervisor looking at" store.
 *
 * The header switcher and every SS screen subscribe to the same module-level
 * state, so picking a site in the header immediately swaps the data on all
 * pages without a reload. The choice is remembered in localStorage.
 */

const STORAGE_KEY = "struktura.ss.selectedProjectId";

type SiteState = {
  sites: SsSiteOption[];
  selectedId: number | null;
  loading: boolean;
  error: string;
};

const initialState: SiteState = { sites: [], selectedId: null, loading: true, error: "" };

let state: SiteState = initialState;
let started = false;

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function remember(projectId: number | null) {
  if (typeof window === "undefined") return;

  if (projectId === null) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, String(projectId));
}

function rememberedId(): number | null {
  if (typeof window === "undefined") return null;

  const parsed = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Load the supervisor's sites once, then keep the selection valid. */
export function loadSsSites(force = false) {
  if (started && !force) return;

  started = true;
  state = { ...state, loading: true, error: "" };
  emit();

  getSsSites()
    .then((response) => {
      const sites = response.data ?? [];
      const stored = rememberedId();
      const valid = sites.some((site) => site.project_id === stored);
      const selectedId = valid ? stored : (sites[0]?.project_id ?? null);

      remember(selectedId);
      state = { sites, selectedId, loading: false, error: "" };
      emit();
    })
    .catch((err) => {
      state = {
        ...state,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load your sites.",
      };
      emit();
    });
}

/** Switch the globally selected site. */
export function selectSsSite(projectId: number) {
  remember(projectId);
  state = { ...state, selectedId: projectId };
  emit();
}

export function subscribeSsSites(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getSsSiteState(): SiteState {
  return state;
}

/** Subscribe a screen to the globally selected site. */
export function useSsSite() {
  const [snapshot, setSnapshot] = useState<SiteState>(initialState);

  useEffect(() => {
    loadSsSites();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnapshot(getSsSiteState());

    return subscribeSsSites(() => setSnapshot(getSsSiteState()));
  }, []);

  const selected = snapshot.sites.find((site) => site.project_id === snapshot.selectedId) ?? null;

  return { ...snapshot, selected };
}
