"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AccountEmailField } from "@/components/auth/account-email-field";
import { AccountPasswordField } from "@/components/auth/account-password-field";
import { TermsAcceptance } from "@/components/auth/terms-acceptance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseSafeToolNext } from "@/lib/auth/route-policy";
import { isValidAccountPassword } from "@/lib/auth/password-policy";
import type { Dictionary } from "@/lib/i18n";
import { localizeUiError } from "@/lib/i18n/errors";
import { User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

function getNextPath() {
  if (typeof window === "undefined") return parseSafeToolNext(null);
  const next = new URLSearchParams(window.location.search).get("next");
  return parseSafeToolNext(next);
}

export function SignUpForm({
  labels,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  labels: Dictionary["auth"];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError(labels.passwordsDoNotMatch);
      setIsLoading(false);
      return;
    }

    if (!isValidAccountPassword(password)) {
      setError(labels.passwordRequirements);
      setIsLoading(false);
      return;
    }

    if (!acceptTerms) {
      setError(labels.termsRequired);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });
      if (signUpError) throw signUpError;

      const next = getNextPath();
      if (data.session) {
        router.push(next);
        router.refresh();
        return;
      }

      const loginPath = `/auth/login?registered=true&next=${encodeURIComponent(next)}`;

      router.push(loginPath);
    } catch (err: unknown) {
      setError(localizeUiError(err, { fallback: labels.errorFallback }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4 md:p-10">
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <Image 
          src="/images/Startseite.svg"
          alt={labels.backgroundAlt}
          fill
          className="object-cover"
          priority
        />
      </div>

      <div className={cn("relative z-10 flex w-full max-w-[476px] flex-col items-start justify-start gap-4 px-4 font-['Space_Grotesk']", className)} {...props}>
        <div className="h-16 flex items-center justify-start">
          <Image 
            src="/images/Logo-weiß.svg"
            alt={labels.logoAlt}
            width={180}
            height={48}
            priority 
            style={{ height: 'auto', width: '180px' }}
            className="object-contain"
          />
        </div>

        <div className="self-stretch pb-4 flex flex-col justify-start items-start gap-2">
          <h1 className="text-4xl font-medium tracking-tight text-foreground">
            {labels.createAccountTitle}
          </h1>
          <p className="text-base font-normal text-foreground/80">
            {labels.createAccountSubtitle}
          </p>
        </div>

        <div className="flex self-stretch flex-col items-start justify-start gap-6 rounded-2xl bg-auth-panel p-8 shadow-none">
          <form onSubmit={handleSignUp} className="w-full flex flex-col gap-5">
            
            <div className="self-stretch flex flex-col justify-start items-start gap-2">
              <Label htmlFor="name" className="text-base font-medium text-auth-foreground">
                {labels.name}
              </Label>
              <div className="relative w-full">
                <User className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-auth-primary" />
                <Input
                  id="name"
                  type="text"
                  placeholder={labels.namePlaceholder}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-input h-12 w-full pr-4 pl-12 text-base font-normal text-auth-foreground shadow-none placeholder:text-auth-placeholder focus-visible:ring-2 focus-visible:ring-auth-primary"
                />
              </div>
            </div>

            <AccountEmailField
              labels={labels}
              value={email}
              onChange={setEmail}
            />

            <AccountPasswordField
              labels={labels}
              value={password}
              onChange={setPassword}
              placeholder={labels.passwordPlaceholder}
              autoComplete="new-password"
              enforceAccountPolicy
            />

            <AccountPasswordField
              labels={labels}
              id="confirmPassword"
              label={labels.confirmPassword}
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder={labels.repeatPassword}
              autoComplete="new-password"
              enforceAccountPolicy
            />

            <TermsAcceptance
              labels={labels}
              checked={acceptTerms}
              onChange={setAcceptTerms}
            />

            {error && <p className="text-sm font-medium text-auth-destructive">{error}</p>}

            <Button 
              type="submit" 
              disabled={isLoading}
              className="mt-2 h-12 w-full rounded-lg bg-auth-primary text-base font-medium text-auth-primary-foreground shadow-none transition-colors hover:bg-auth-primary-hover"
            >
              {isLoading ? labels.creatingAccount : labels.createAccountTitle}
            </Button>
          </form>
        </div>

        <div className="mt-2 flex items-center justify-center gap-1 self-stretch text-base text-foreground">
          <span className="font-normal">{labels.alreadyHaveAnAccount}</span>
          <Link
            href={
              `/auth/login?next=${encodeURIComponent(getNextPath())}`
            }
            className="font-semibold text-foreground decoration-2 hover:underline"
          >
            {labels.login}
          </Link>
        </div>

      </div>
    </div>
  );
}
