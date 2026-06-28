"use client";

import { AccountEmailField } from "@/components/auth/account-email-field";
import { AccountPasswordField } from "@/components/auth/account-password-field";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginErrorType = "invalidCredentials" | "tooManyAttempts" | null;

const RATE_LIMIT_ERROR_CODES = new Set([
  "over_request_rate_limit",
  "over_email_send_rate_limit",
]);

const INVALID_CREDENTIALS_ERROR =
  "E-Mail-Adresse oder Passwort ist nicht korrekt. Bitte pr\u00fcfen Sie Ihre Eingabe.";
const TOO_MANY_ATTEMPTS_ERROR =
  "Zu viele Anmeldeversuche. Bitte warten Sie 15 Minuten oder setzen Sie Ihr Passwort zur\u00fcck.";

function getSupabaseAuthErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      name: undefined,
      message: undefined,
      status: undefined,
      code: undefined,
    };
  }

  const errorRecord = error as Record<string, unknown>;

  return {
    name: error instanceof Error ? error.name : undefined,
    message:
      typeof errorRecord.message === "string"
        ? errorRecord.message
        : error instanceof Error
          ? error.message
          : undefined,
    status:
      typeof errorRecord.status === "number" ? errorRecord.status : undefined,
    code:
      typeof errorRecord.code === "string" ? errorRecord.code : undefined,
  };
}

function isTooManyAttemptsError(error: unknown) {
  const { status, code } = getSupabaseAuthErrorDetails(error);

  return status === 429 || (code ? RATE_LIMIT_ERROR_CODES.has(code) : false);
}

function getNextPath() {
  if (typeof window === "undefined") return "/tool/organizations";
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/tool/organizations";
  }
  return next;
}

export function LoginForm({
  labels,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  labels: Dictionary["auth"];
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // TEST ONLY: Temporarily initialize this with "tooManyAttempts" to preview the locked amber state.
  const [errorType, setErrorType] = useState<LoginErrorType>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const isTooManyAttempts = errorType === "tooManyAttempts";
  const error =
    errorType === "invalidCredentials"
      ? INVALID_CREDENTIALS_ERROR
      : errorType === "tooManyAttempts"
        ? TOO_MANY_ATTEMPTS_ERROR
        : null;
  const fieldErrorTone =
    errorType === "invalidCredentials"
      ? "red"
      : errorType === "tooManyAttempts"
        ? "amber"
        : null;

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    if (isTooManyAttempts) return;

    const supabase = createClient();
    setIsLoading(true);
    setErrorType(null);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) {
        if (process.env.NODE_ENV !== "production") {
          console.info(
            "Supabase login error",
            getSupabaseAuthErrorDetails(loginError),
          );
        }

        throw loginError;
      }

      router.replace(getNextPath());
      router.refresh();
    } catch (caught) {
      const nextErrorType: LoginErrorType = isTooManyAttemptsError(caught)
        ? "tooManyAttempts"
        : "invalidCredentials";

      setErrorType(nextErrorType);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "flex w-full max-w-110.5 flex-col items-start gap-4 px-4 font-['Space_Grotesk']",
        className,
      )}
      {...props}
    >
      <div className="flex h-16 items-center justify-start">
        <Image
          src="/images/Logo-weiß.svg"
          alt="complyX Logo"
          width={180}
          height={48}
          priority
          className="object-contain"
        />
      </div>

      <div className="flex self-stretch flex-col items-start gap-2 pb-4">
        <h1 className="text-4xl font-medium tracking-tight text-neutral-50">
          {labels.welcomeBack}
        </h1>
        <p className="text-base font-normal text-neutral-50/80">
          {labels.signInDescription}
        </p>
      </div>

      <div className="flex self-stretch flex-col items-start gap-6 rounded-2xl border-0 bg-[#FAFAFA] p-9 shadow-none">
        <form onSubmit={handleLogin} className="flex w-full flex-col gap-6">
          {error ? (
            <div
              role="alert"
              className={cn(
                "flex min-h-16 w-full items-start rounded-lg border-[1.5px] px-4 py-3.5 text-xs font-normal",
                errorType === "tooManyAttempts"
                  ? "border-amber-700 bg-amber-50 text-amber-700"
                  : "border-red-600 bg-red-50 text-red-600",
              )}
            >
              {error}
            </div>
          ) : null}

          <AccountEmailField
            labels={labels}
            value={email}
            onChange={setEmail}
            errorTone={fieldErrorTone}
            muted={isTooManyAttempts}
          />

          <AccountPasswordField
            labels={labels}
            value={password}
            onChange={setPassword}
            errorTone={fieldErrorTone}
            muted={isTooManyAttempts}
            placeholder="••••••••"
            labelAction={
              <Link
                href="/auth/forgot-password"
                className="text-sm font-medium text-[#002AFF] hover:underline"
              >
                {labels.forgotPassword}
              </Link>
            }
          />

          <div className="flex items-center gap-2 self-stretch">
            <input
              type="checkbox"
              id="remember"
              disabled={isTooManyAttempts}
              className={cn(
                "auth-checkbox size-5 cursor-pointer shadow-none",
                isTooManyAttempts &&
                  "cursor-not-allowed border-gray-200 bg-gray-100",
              )}
            />
            <label
              htmlFor="remember"
              className={cn(
                "cursor-pointer select-none text-base font-medium text-gray-950",
                isTooManyAttempts && "cursor-not-allowed text-gray-400",
              )}
            >
              {labels.keepSignedIn}
            </label>
          </div>

          <Button
            type="submit"
            disabled={isLoading || isTooManyAttempts}
            className={cn(
              "h-12 w-full rounded-lg bg-[#002AFF] text-base font-medium text-white shadow-none transition-colors hover:bg-[#0022cc]",
              isTooManyAttempts &&
                "cursor-not-allowed bg-gray-100 text-gray-400 hover:bg-gray-100 disabled:opacity-100",
            )}
          >
            {isLoading ? labels.signingIn : labels.login}
          </Button>
        </form>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1 self-stretch text-base text-white">
        {isTooManyAttempts ? (
          <Link
            href="/auth/forgot-password"
            className="font-bold decoration-2 hover:underline"
          >
            ← Passwort zurücksetzen
          </Link>
        ) : (
          <>
            <span className="font-normal">{labels.noAccount}</span>
            <Link
              href={
                getNextPath() !== "/tool/organizations"
                  ? `/auth/sign-up?next=${encodeURIComponent(getNextPath())}`
                  : "/auth/sign-up"
              }
              className="font-bold decoration-2 hover:underline"
            >
              {labels.signUp}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
