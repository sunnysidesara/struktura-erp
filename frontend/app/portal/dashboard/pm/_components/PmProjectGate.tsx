"use client";

import type { ReactNode } from "react";
import { SaPanel } from "@/app/portal/dashboard/sa/_components/SaPage";
import { usePmProject } from "./projectSelection";
import pmStyles from "../page.module.css";

/** PM content gate: renders only after a project is picked in My Projects. */
export function PmProjectGate({ children }: { children: (projectId: number) => ReactNode }) {
  const { selectedId, loading, error } = usePmProject();

  if (loading) {
    return (
      <SaPanel title="Loading project">
        <p className={pmStyles.notice}>Loading your projects...</p>
      </SaPanel>
    );
  }

  if (error !== "") {
    return (
      <SaPanel title="Could not load your projects">
        <p className={pmStyles.noticeError}>{error}</p>
      </SaPanel>
    );
  }

  if (!selectedId) {
    return (
      <SaPanel title="No project selected">
        <p className={pmStyles.notice}>
          Choose a project from &ldquo;My Projects&rdquo; in the header, or select one on the
          Overview page.
        </p>
      </SaPanel>
    );
  }

  return <>{children(selectedId)}</>;
}
