"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import { localizeUiError } from "@/lib/i18n/errors";
import { ArrowLeft, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export function ForgotPasswordForm({
  labels,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  labels: Dictionary["auth"];
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      // The url which will be included in the email. This URL needs to be configured in your redirect URLs in the Supabase dashboard at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(localizeUiError(error, { fallback: labels.errorFallback }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex min-h-svh w-full items-center justify-center overflow-hidden bg-[#02040E] px-4 py-8 font-['Space_Grotesk'] sm:px-6 lg:px-10"
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        <Image
          src="/images/Startseite.svg"
          alt={labels.backgroundAlt}
          fill
          className="object-cover"
          priority
        />
      </div>

      <div
        className={cn(
          "relative z-10 flex w-full max-w-[476px] flex-col items-start gap-4 overflow-hidden px-4",
          className,
        )}
      >
        <div className="inline-flex h-16 w-56 items-center justify-start overflow-hidden bg-white/0 py-10">
          <Image
            src="/images/Logo-weiß.svg"
            alt={labels.logoAlt}
            width={227}
            height={74}
            priority
            className="h-20 w-56 object-contain"
          />
        </div>

        <div className="inline-flex self-stretch flex-col items-start justify-start gap-6 overflow-hidden bg-white/0 pb-4">
          <h1 className="h-5 self-stretch text-4xl font-medium leading-none text-white">
            {success ? labels.checkEmailTitle : labels.forgotPassword}
          </h1>
          <p className="self-stretch text-base font-normal leading-normal text-white">
            {success
              ? labels.resetInstructionsSent
              : labels.forgotPasswordDescription}
          </p>
        </div>

        <div className="flex self-stretch flex-col items-start gap-6 overflow-hidden rounded-2xl bg-neutral-50 p-8 shadow-[0px_8px_32px_-4px_rgba(0,0,0,0.10)]">
          {success ? (
            <p className="text-base font-normal leading-6 text-gray-600">
              {labels.resetEmailSent}
            </p>
          ) : (
            <form
              onSubmit={handleForgotPassword}
              className="flex w-full flex-col gap-6"
            >
              <div className="flex self-stretch flex-col items-start gap-2 overflow-hidden bg-white/0">
                <label
                  htmlFor="email"
                  className="text-base font-medium text-black"
                >
                  {labels.email}
                </label>
                <div className="inline-flex h-12 self-stretch items-center justify-start gap-4 overflow-hidden rounded-lg bg-white px-4 py-3 outline outline-[1.5px] -outline-offset-[1.5px] outline-gray-200">
                  <Mail className="pointer-events-none size-5 shrink-0 text-blue-700" />
                  <input
                    id="email"
                    type="email"
                    placeholder={labels.emailPlaceholder}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-full min-w-0 flex-1 bg-transparent text-base font-normal text-black outline-none placeholder:text-gray-600"
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="text-sm font-medium text-red-600">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-lg bg-blue-700 text-base font-medium text-white shadow-none transition-colors hover:bg-blue-800"
                disabled={isLoading}
              >
                {isLoading ? labels.sending : labels.sendResetEmail}
              </Button>
            </form>
          )}
        </div>

        <div className="inline-flex items-center justify-center gap-1 overflow-hidden bg-white/0 text-base text-white">
          <ArrowLeft aria-hidden="true" className="size-4" />
          <span className="font-medium leading-5">{labels.backToLogin} </span>
          <div className="relative h-5 w-24">
            <Link
              href="/auth/login"
              className="absolute left-0 top-0 font-bold leading-5 hover:underline"
            >
              {labels.login}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
