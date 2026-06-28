"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { AccountEmailField } from "@/components/auth/account-email-field";
import { AccountPasswordField } from "@/components/auth/account-password-field";
import { TermsAcceptance } from "@/components/auth/terms-acceptance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidAccountPassword } from "@/lib/auth/password-policy";
import type { Dictionary } from "@/lib/i18n";
import { User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

function getNextPath() {
  if (typeof window === "undefined") return null;
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return null;
  }
  return next;
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
      const { error: signUpError } = await supabase.auth.signUp({
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
      const loginPath = next
        ? `/auth/login?registered=true&next=${encodeURIComponent(next)}`
        : "/auth/login?registered=true";

      router.push(loginPath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : labels.errorFallback);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#02040E] flex items-center justify-center overflow-hidden p-4 md:p-10">
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <Image 
          src="/images/Startseite.svg"
          alt={labels.backgroundAlt}
          fill
          className="object-cover"
          priority
        />
      </div>

      <div className={cn("relative z-10 w-full max-w-110.5 flex flex-col justify-start items-start gap-4 font-['Space_Grotesk']", className)} {...props}>
        <div className="h-16 flex items-center justify-start">
          <Image 
            src="/images/Logo-weiß.svg"
            alt="complyX Logo"
            width={180}
            height={48}
            priority 
            style={{ height: 'auto', width: '180px' }}
            className="object-contain"
          />
        </div>

        <div className="self-stretch pb-4 flex flex-col justify-start items-start gap-2">
          <h1 className="text-white text-4xl font-medium tracking-tight">
            {labels.createAccountTitle}
          </h1>
          <p className="text-white/80 text-base font-normal">
            {labels.createAccountSubtitle}
          </p>
        </div>

        <div className="self-stretch p-8 bg-[#FAFAFA] rounded-2xl shadow-none flex flex-col justify-start items-start gap-6">
          <form onSubmit={handleSignUp} className="w-full flex flex-col gap-5">
            
            <div className="self-stretch flex flex-col justify-start items-start gap-2">
              <Label htmlFor="name" className="text-black text-base font-medium">
                {labels.name}
              </Label>
              <div className="relative w-full">
                <User className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#002AFF]" />
                <Input
                  id="name"
                  type="text"
                  placeholder={labels.namePlaceholder}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="auth-input w-full h-12 pl-12 pr-4 text-black text-base font-normal shadow-none focus-visible:ring-2 focus-visible:ring-[#002AFF] placeholder:text-[#4A5565]"
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

            {error && <p className="text-sm text-destructive font-medium">{error}</p>}

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-12 bg-[#002AFF] hover:bg-[#0022cc] text-white text-base shadow-none font-medium rounded-lg transition-colors mt-2"
            >
              {isLoading ? labels.creatingAccount : labels.createAccountTitle}
            </Button>
          </form>
        </div>

        <div className="self-stretch flex justify-center items-center gap-1 mt-2 text-white text-base">
          <span className="font-normal">{labels.alreadyHaveAnAccount}</span>
          <Link
            href={
              getNextPath()
                ? `/auth/login?next=${encodeURIComponent(getNextPath() ?? "")}`
                : "/auth/login"
            }
            className="font-semibold hover:underline decoration-2 text-white"
          >
            {labels.login}
          </Link>
        </div>

      </div>
    </div>
  );
}
