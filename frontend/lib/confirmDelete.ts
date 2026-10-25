/**
 * Shared destructive-action guard used by every delete, remove, and void
 * button in the portal.
 */
export function confirmDelete(message: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.confirm(`WARNING\n\n${message}\n\nDo you want to continue?`);
}
