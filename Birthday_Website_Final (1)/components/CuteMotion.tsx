"use client";

import { useEffect, useRef } from "react";
import { startCuteMotion } from "@/lib/cuteMotion";

/**
 * Decorative overlay: floating hearts, sparkles, confetti and balloons.
 * Sits on top of the page, never captures clicks, and adds nothing to the layout.
 */
export default function CuteMotion() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    return startCuteMotion(canvas);
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
