"use client";

import { AccountEmailField } from "@/components/auth/account-email-field";
import { AccountPasswordField } from "@/components/auth/account-password-field";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { parseSafeToolNext } from "@/src/auth/route-policy";
import type { Dictionary } from "@/src/i18n";
import { classifyExternalError } from "@/src/i18n/errors";
import { createClient } from "@/src/supabase/client";
import { cn } from "@/src/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginErrorType = "invalidCredentials" | "tooManyAttempts" | null;

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
  return classifyExternalError(error) === "RATE_LIMITED";
}

function getNextPath() {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next");
  return next ? parseSafeToolNext(next) : "/";
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
      ? labels.invalidCredentials
      : errorType === "tooManyAttempts"
        ? labels.tooManyAttempts
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
        "flex w-full max-w-[476px] flex-col items-start gap-4 px-4 font-['Space_Grotesk'] sm:px-6",
        className,
      )}
      {...props}
    >
      <Link
        href="/"
        aria-label={labels.logoAlt}
        className="flex h-16 items-center justify-start"
      >
        <BrandLogo
          alt={labels.logoAlt}
          width={180}
          height={48}
          priority
          className="object-contain"
        />
      </Link>

      <div className="flex self-stretch flex-col items-start gap-2 pb-4">
        <h1 className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          {labels.welcomeBack}
        </h1>
        <p className="text-base font-normal text-[#002BFF] dark:text-foreground/80">
          {labels.signInDescription}
        </p>
      </div>

      <div className="flex self-stretch flex-col items-start gap-6 rounded-2xl border-0 bg-auth-panel p-5 shadow-none sm:p-9">
        <form onSubmit={handleLogin} className="flex w-full flex-col gap-6">
          {error ? (
            <div
              role="alert"
              className={cn(
                "flex min-h-16 w-full items-start rounded-lg border-[1.5px] px-4 py-3.5 text-xs font-normal",
                errorType === "tooManyAttempts"
                  ? "border-auth-warning bg-auth-warning-background text-auth-warning"
                  : "border-auth-destructive bg-auth-destructive-background text-auth-destructive",
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
                className="text-sm font-medium text-auth-primary hover:underline"
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
                  "cursor-not-allowed border-auth-border bg-auth-muted",
              )}
            />
            <label
              htmlFor="remember"
              className={cn(
                "cursor-pointer select-none text-base font-medium text-auth-foreground",
                isTooManyAttempts &&
                  "cursor-not-allowed text-auth-muted-foreground",
              )}
            >
              {labels.keepSignedIn}
            </label>
          </div>

          <Button
            type="submit"
            disabled={isLoading || isTooManyAttempts}
            className={cn(
              "h-12 w-full rounded-lg bg-auth-primary text-base font-medium text-auth-primary-foreground shadow-none transition-colors hover:bg-auth-primary-hover",
              isTooManyAttempts &&
                "cursor-not-allowed bg-auth-muted text-auth-muted-foreground hover:bg-auth-muted disabled:opacity-100",
            )}
          >
            {isLoading ? labels.signingIn : labels.login}
          </Button>
        </form>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-1 self-stretch text-center text-base text-foreground">
        {isTooManyAttempts ? (
          <Link
            href="/auth/forgot-password"
            className="font-bold decoration-2 hover:underline"
          >
            {labels.resetPasswordLink}
          </Link>
        ) : (
          <>
            <span className="font-normal">{labels.noAccount}</span>
            <Link
              href={
                getNextPath() !== "/"
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
