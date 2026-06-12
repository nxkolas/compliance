"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import { ACCOUNT_PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import { Eye, EyeOff, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

export function AccountPasswordField({
  labels,
  value,
  onChange,
  id = "password",
  label = labels.password,
  placeholder,
  autoComplete = "current-password",
  enforceAccountPolicy = false,
  labelAction,
}: {
  labels: Dictionary["auth"];
  value: string;
  onChange: (value: string) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  autoComplete?: "current-password" | "new-password";
  enforceAccountPolicy?: boolean;
  labelAction?: ReactNode;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col items-start gap-2 self-stretch">
      <div className="flex items-center justify-between self-stretch">
        <Label htmlFor={id} className="text-base font-medium text-black">
          {label}
        </Label>
        {labelAction}
      </div>
      <div className="relative w-full">
        <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#002AFF]" />
        <Input
          id={id}
          name={id}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          minLength={
            enforceAccountPolicy ? ACCOUNT_PASSWORD_MIN_LENGTH : undefined
          }
          pattern={enforceAccountPolicy ? "(?=.*\\d).{10,}" : undefined}
          title={enforceAccountPolicy ? labels.passwordRequirements : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="auth-input h-12 w-full pl-12 pr-12 text-base font-normal text-black shadow-none placeholder:text-[#4A5565] focus-visible:ring-2 focus-visible:ring-[#002AFF]"
        />
        <button
          type="button"
          aria-label={
            showPassword ? labels.hidePassword : labels.showPassword
          }
          onClick={() => setShowPassword((visible) => !visible)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-[#002AFF] focus:outline-none"
        >
          {showPassword ? (
            <EyeOff className="size-5" />
          ) : (
            <Eye className="size-5" />
          )}
        </button>
      </div>
    </div>
  );
}
