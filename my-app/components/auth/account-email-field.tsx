"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/src/i18n";
import { cn } from "@/src/utils";
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
  const backgroundColor = muted ? "var(--auth-muted)" : "var(--auth-background)";

  return (
    <div className="flex flex-col items-start gap-2 self-stretch">
      <Label
        htmlFor={id}
        className={cn(
          "text-base font-medium text-auth-foreground",
          muted && "text-auth-muted-foreground",
        )}
      >
        {labels.email}
      </Label>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-lg border-[1.5px] border-auth-border !bg-auth-background transition-shadow focus-within:ring-2 focus-within:ring-auth-primary",
          muted && "!bg-auth-muted",
          errorTone === "red" &&
            "border-auth-destructive focus-within:border-auth-destructive focus-within:ring-1 focus-within:ring-auth-destructive",
          errorTone === "amber" &&
            "border-auth-warning focus-within:border-auth-warning focus-within:ring-1 focus-within:ring-auth-warning",
        )}
        style={{ backgroundColor }}
      >
        <Mail
          className={cn(
            "pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-auth-primary",
            muted && "text-auth-muted-foreground",
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
            "h-12 w-full border-0 !bg-auth-background pl-12 pr-4 text-base font-normal text-auth-foreground shadow-none [color-scheme:light] placeholder:text-auth-placeholder focus-visible:border-transparent focus-visible:ring-0 aria-invalid:border-transparent disabled:!bg-auth-background disabled:!opacity-100",
            muted &&
              "!bg-auth-muted text-auth-muted-foreground placeholder:text-auth-muted-foreground disabled:!bg-auth-muted",
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
