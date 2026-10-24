"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Fetch an SS endpoint and expose a `reload()` so forms can refresh
 * after a successful write.
 */
export function useSsResource<T>(loader: () => Promise<T>, projectId?: number | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (projectId === null || projectId === undefined) {
      // A site must be selected first; nothing loads before that.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
       
      setLoading(false);
       
      setError("");
      return;
    }

    let active = true;
     
    setLoading(true);
     
    setError("");

    loader()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // Reload when the site switcher changes or a form calls reload().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, projectId]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return { data, loading, error, reload };
}
