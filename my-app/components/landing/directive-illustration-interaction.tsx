"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function DirectiveIllustrationInteraction({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const illustrationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const illustration = illustrationRef.current;
    if (!illustration) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsExpanded(entry.isIntersecting),
      {
        threshold: 0.25,
        rootMargin: "-15% 0px -20% 0px",
      },
    );

    observer.observe(illustration);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={illustrationRef}
      aria-hidden="true"
      data-expanded={isExpanded}
      className="group relative mt-14 h-[280px] w-full max-w-[520px]"
    >
      {children}
    </div>
  );
}
