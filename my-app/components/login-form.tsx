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
  guestAssessmentId,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  labels: Dictionary["auth"];
  guestAssessmentId?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) throw loginError;

      if (guestAssessmentId) {
        const response = await fetch(
          `/api/guest-assessments/${guestAssessmentId}/claim`,
          { method: "POST" },
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Übernahme fehlgeschlagen");
        }
        router.replace(`/tool/assessments/${guestAssessmentId}/result`);
        router.refresh();
        return;
      }

      router.replace(getNextPath());
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.errorFallback);
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
          {guestAssessmentId
            ? "Mit bestehendem Konto übernehmen"
            : labels.welcomeBack}
        </h1>
        <p className="text-base font-normal text-neutral-50/80">
          {guestAssessmentId
            ? "Melden Sie sich an, um den Schnellcheck mit Ihrem Konto zu verknüpfen."
            : labels.signInDescription}
        </p>
      </div>

      <div className="flex self-stretch flex-col items-start gap-6 rounded-2xl border-0 bg-[#FAFAFA] p-9 shadow-none">
        <form onSubmit={handleLogin} className="flex w-full flex-col gap-6">
          <AccountEmailField
            labels={labels}
            value={email}
            onChange={setEmail}
          />

          <AccountPasswordField
            labels={labels}
            value={password}
            onChange={setPassword}
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
              className="auth-checkbox size-5 cursor-pointer shadow-none"
            />
            <label
              htmlFor="remember"
              className="cursor-pointer select-none text-base font-medium text-gray-950"
            >
              {labels.keepSignedIn}
            </label>
          </div>

          {error ? (
            <p className="text-sm font-medium text-destructive">{error}</p>
          ) : null}

          <Button
            type="submit"
            disabled={isLoading}
            className="h-12 w-full rounded-lg bg-[#002AFF] text-base font-medium text-white shadow-none transition-colors hover:bg-[#0022cc]"
          >
            {isLoading
              ? labels.signingIn
              : guestAssessmentId
                ? "Anmelden und übernehmen"
                : labels.login}
          </Button>
        </form>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1 self-stretch text-base text-white">
        <span className="font-normal">{labels.noAccount}</span>
        <Link
          href={
            guestAssessmentId
              ? `/check/${guestAssessmentId}/create-account`
              : "/auth/sign-up"
          }
          className="font-bold decoration-2 hover:underline"
        >
          {labels.signUp}
        </Link>
      </div>
    </div>
  );
}
