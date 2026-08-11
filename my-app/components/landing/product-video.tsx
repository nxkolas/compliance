"use client";

import { useRef, useState } from "react";

type ProductVideoProps = {
  title: string;
  playLabel: string;
  fallback: string;
};

export function ProductVideo({ title, playLabel, fallback }: ProductVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const playVideo = () => {
    const video = videoRef.current;
    if (!video || !video.paused) return;

    setHasStarted(true);
    void video.play().catch((error: unknown) => {
      console.error("Unable to start the product video", error);
      setHasStarted(false);
    });
  };

  const resetVideo = () => {
    setHasStarted(false);
    videoRef.current?.load();
  };

  return (
    <div className="relative aspect-[1089/605] w-full bg-[#02040E]">
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        poster="/images/landing/product-demo-poster.svg"
        aria-label={title}
        onPlay={() => setHasStarted(true)}
        onEnded={resetVideo}
        className="absolute inset-0 h-full w-full bg-[#02040E] object-cover"
      >
        <source src="/videos/product-demo.mp4" type="video/mp4" />
        {fallback}
      </video>

      {!hasStarted && (
        <button
          type="button"
          onPointerDown={playVideo}
          onClick={playVideo}
          aria-label={playLabel}
          className="absolute left-1/2 top-[52.8%] z-10 size-28 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-transparent outline-none transition-transform duration-150 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#02040E] active:scale-95 sm:size-32"
        />
      )}
    </div>
  );
}
