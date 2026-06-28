"use client";

import type { Dictionary } from "@/lib/i18n";

export function TermsAcceptance({
  labels,
  checked,
  onChange,
  id = "terms",
}: {
  labels: Dictionary["auth"];
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  return (
    <div className="flex items-start gap-2 self-stretch pt-1">
      <input
        type="checkbox"
        id={id}
        required
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="auth-checkbox mt-0.5 size-5 shrink-0 cursor-pointer"
      />
      <label
        htmlFor={id}
        className="cursor-pointer select-none text-sm font-normal leading-tight text-[#4A5565]"
      >
        {labels.acceptTermsPrefix}{" "}
        <span className="text-[#002AFF]">
          {labels.terms}
        </span>{" "}
        {labels.termsConnector}{" "}
        <span className="text-[#002AFF]">
          {labels.privacyPolicy}
        </span>
        .
      </label>
    </div>
  );
}
