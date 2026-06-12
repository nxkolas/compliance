"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import { Mail } from "lucide-react";

export function AccountEmailField({
  labels,
  value,
  onChange,
  id = "email",
}: {
  labels: Dictionary["auth"];
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2 self-stretch">
      <Label htmlFor={id} className="text-base font-medium text-black">
        {labels.email}
      </Label>
      <div className="relative w-full">
        <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#002AFF]" />
        <Input
          id={id}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={labels.emailPlaceholder}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="auth-input h-12 w-full pl-12 pr-4 text-base font-normal text-black shadow-none placeholder:text-[#4A5565] focus-visible:ring-2 focus-visible:ring-[#002AFF]"
        />
      </div>
    </div>
  );
}
