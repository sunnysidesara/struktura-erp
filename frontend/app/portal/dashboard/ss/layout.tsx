"use client";

import type { ReactNode } from "react";

/**
 * Each supervisor page is now a master/detail view (site list → popup), so the
 * layout only renders the page content.
 */
export default function SiteSupervisorLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
