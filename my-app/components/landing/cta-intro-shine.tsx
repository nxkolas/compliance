"use client";

import { useEffect, useRef, useState } from "react";

type ShinePhase = "idle" | "prepare-right" | "sweep-right" | "prepare-left" | "sweep-left";

export function CtaIntroShine() {
  const [phase, setPhase] = useState<ShinePhase>("idle");
  const observerTargetRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const observerTarget = observerTargetRef.current;
    if (!observerTarget) return;

    let timers: number[] = [];
    let wasVisible = false;

    const clearTimers = () => {
      timers.forEach(window.clearTimeout);
      timers = [];
    };

    const runShine = () => {
      clearTimers();
      setPhase("prepare-right");
      timers = [
        window.setTimeout(() => setPhase("sweep-right"), 100),
        window.setTimeout(() => setPhase("prepare-left"), 900),
        window.setTimeout(() => setPhase("sweep-left"), 1_050),
        window.setTimeout(() => setPhase("idle"), 1_850),
      ];
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;

        if (isVisible && !wasVisible) runShine();
        if (!isVisible) {
          clearTimers();
          setPhase("idle");
        }

        wasVisible = isVisible;
      },
      { threshold: 0.6 },
    );

    observer.observe(observerTarget);

    return () => {
      clearTimers();
      observer.disconnect();
    };
  }, []);

  const shinesToRight = phase === "sweep-right";
  const shinesToLeft = phase === "prepare-left";

  return (
    <span
      ref={observerTargetRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
    >
      <span
        className={`absolute top-[-50%] h-[200%] w-[22%] rotate-[18deg] bg-gradient-to-r from-transparent via-white/30 to-transparent blur-[1px] ${
          shinesToRight
            ? "left-[115%] transition-[left] duration-700 ease-out"
            : shinesToLeft
              ? "left-[115%] opacity-0 transition-none"
              : phase === "sweep-left"
                ? "-left-[35%] transition-[left] duration-700 ease-out"
                : "-left-[35%] opacity-0 transition-none"
        }`}
      />
    </span>
  );
}
