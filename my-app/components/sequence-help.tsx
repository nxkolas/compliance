"use client";

import { useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function SequenceHelp({ label, explanation }: { label: string; explanation: string }) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose() {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function scheduleClose() {
    cancelClose();
    if (!pinned.current) closeTimer.current = setTimeout(() => setOpen(false), 180);
  }

  useEffect(() => () => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }, []);

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      cancelClose();
      pinned.current = nextOpen;
      setOpen(nextOpen);
    }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-sequence-help
          className="flex min-h-11 cursor-pointer items-center gap-[18px] rounded-lg text-left text-white transition-colors hover:text-blue-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400"
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse") return;
            cancelClose();
            setOpen(true);
          }}
          onPointerLeave={scheduleClose}
        >
          <CircleHelp aria-hidden="true" className="size-7 shrink-0" strokeWidth={1.33} />
          <span className="text-base leading-5 font-medium">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        collisionPadding={16}
        aria-label={label}
        className="max-h-[var(--radix-popover-content-available-height)] w-96 max-w-[calc(100vw-32px)] overflow-y-auto rounded-xl border-[#3D4049] bg-[#1B1E27] p-5 text-sm leading-6 text-white shadow-xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={cancelClose}
        onPointerLeave={scheduleClose}
      >
        <p className="whitespace-pre-line">{explanation}</p>
        <PopoverPrimitive.Arrow width={16} height={8} className="fill-[#1B1E27]" />
      </PopoverContent>
    </Popover>
  );
}
