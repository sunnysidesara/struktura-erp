"use client";

import type { ReactNode } from "react";
import { SaPanel } from "@/app/portal/dashboard/sa/_components/SaPage";
import { useSsSite } from "./siteSelection";
import ssStyles from "../ss.module.css";

/**
 * Renders SS content only once a site is selected in the header switcher.
 */
export function SsSiteGate({ children }: { children: (projectId: number) => ReactNode }) {
  const { selectedId, loading, error } = useSsSite();

  if (loading) {
    return (
      <SaPanel title="Loading site">
        <p className={ssStyles.muted}>Loading your site data...</p>
      </SaPanel>
    );
  }

  if (error !== "") {
    return (
      <SaPanel title="Could not load your sites">
        <p className={ssStyles.noticeError}>{error}</p>
      </SaPanel>
    );
  }

  if (!selectedId) {
    return (
      <SaPanel title="No site selected">
        <p className={ssStyles.muted}>
          Choose one of your sites from &ldquo;My Sites&rdquo; in the header to load its details.
        </p>
      </SaPanel>
    );
  }

  return <>{children(selectedId)}</>;
}
