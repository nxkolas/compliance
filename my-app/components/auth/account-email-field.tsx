"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Mail } from "lucide-react";

export function AccountEmailField({
  labels,
  value,
  onChange,
  id = "email",
  errorTone = null,
  muted = false,
}: {
  labels: Dictionary["auth"];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  errorTone?: "red" | "amber" | null;
  muted?: boolean;
}) {
  const hasError = Boolean(errorTone);
  const backgroundColor = muted ? "#f3f4f6" : "#ffffff";

  return (
    <div className="flex flex-col items-start gap-2 self-stretch">
      <Label
        htmlFor={id}
        className={cn(
          "text-base font-medium text-black",
          muted && "text-gray-400",
        )}
      >
        {labels.email}
      </Label>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-lg border-[1.5px] border-[var(--auth-border)] !bg-white transition-shadow focus-within:ring-2 focus-within:ring-[#002AFF]",
          muted && "!bg-gray-100",
          errorTone === "red" &&
            "border-red-600 focus-within:border-red-600 focus-within:ring-1 focus-within:ring-red-600",
          errorTone === "amber" &&
            "border-amber-700 focus-within:border-amber-700 focus-within:ring-1 focus-within:ring-amber-700",
        )}
        style={{ backgroundColor }}
      >
        <Mail
          className={cn(
            "pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#002AFF]",
            muted && "text-gray-400",
          )}
        />
        <Input
          id={id}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={labels.emailPlaceholder}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={hasError}
          className={cn(
            "h-12 w-full border-0 !bg-white pl-12 pr-4 text-base font-normal text-black shadow-none [color-scheme:light] placeholder:text-[#4A5565] focus-visible:border-transparent focus-visible:ring-0 aria-invalid:border-transparent disabled:!bg-white disabled:!opacity-100",
            muted &&
              "!bg-gray-100 text-gray-400 placeholder:text-gray-400 disabled:!bg-gray-100",
          )}
          style={{
            backgroundColor,
            WebkitBoxShadow: `0 0 0 1000px ${backgroundColor} inset`,
          }}
        />
      </div>
    </div>
  );
}
