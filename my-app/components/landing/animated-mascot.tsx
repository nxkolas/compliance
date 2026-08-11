"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import styles from "./animated-mascot.module.css";

const mascotAsset = "/images/landing/landingpage-maskottchen-mit-logo.svg";

export function AnimatedMascot() {
  const [isActivated, setIsActivated] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  function activateMascot() {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    setIsActivated(false);
    requestAnimationFrame(() => {
      setIsActivated(true);
      resetTimerRef.current = setTimeout(() => setIsActivated(false), 850);
    });
  }

  return (
    <button
      type="button"
      aria-label="ComplyX Maskottchen aktivieren"
      className={styles.root}
      data-activated={isActivated}
      onClick={activateMascot}
    >
      <Image
        src={mascotAsset}
        alt="ComplyX Maskottchen"
        width={1024}
        height={1024}
        className={styles.illustration}
      />
    </button>
  );
}
