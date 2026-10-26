"use client";

import { useEffect, useRef, useState } from "react";
import SpinnerRing from "@/app/portal/_components/SpinnerRing";
import { subscribeApiLoading } from "@/lib/loading";
import styles from "./AppLoadingScreen.module.css";

// Avoid a flash on fast responses, but keep the spinner readable once shown.
const SHOW_DELAY_MS = 180;
const MIN_VISIBLE_MS = 250;

export default function AppLoadingScreen() {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const shownAt = useRef(0);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeApiLoading((busy) => {
      if (busy) {
        if (hideTimer.current) {
          clearTimeout(hideTimer.current);
          hideTimer.current = null;
        }

        if (visibleRef.current || showTimer.current) {
          return;
        }

        showTimer.current = setTimeout(() => {
          showTimer.current = null;
          shownAt.current = Date.now();
          visibleRef.current = true;
          setVisible(true);
        }, SHOW_DELAY_MS);

        return;
      }

      if (showTimer.current) {
        clearTimeout(showTimer.current);
        showTimer.current = null;
      }

      if (!visibleRef.current) {
        return;
      }

      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));

      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }

      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        visibleRef.current = false;
        setVisible(false);
      }, remaining);
    });

    return () => {
      unsubscribe();

      if (showTimer.current) {
        clearTimeout(showTimer.current);
      }

      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={styles.loadingScreen}
      role="status"
      aria-live="polite"
      aria-label="Loading data from the database"
    >
      <SpinnerRing />

    </div>
  );
}