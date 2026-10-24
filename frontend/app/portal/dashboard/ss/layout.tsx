"use client";

import type { ReactNode } from "react";

/**
 * Supervisor pages read the site chosen in the header "My Sites" switcher, so
 * the layout only renders the page content.
 */
export default function SiteSupervisorLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
