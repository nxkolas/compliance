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

export function SignUpForm({
  labels,
  guestAssessmentId,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  labels: Dictionary["auth"];
  guestAssessmentId?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string>();
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
      if (guestAssessmentId) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user?.is_anonymous) {
          throw new Error("Die anonyme Sitzung ist nicht mehr verfügbar.");
        }

        const next = `/tool/organizations/claim-assessment/${guestAssessmentId}`;
        const { error: updateError } = await supabase.auth.updateUser(
          { email, password },
          {
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
          },
        );
        if (updateError) throw updateError;

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!signInError) {
          const {
            data: { user: signedInUser },
            error: signedInUserError,
          } = await supabase.auth.getUser();
          if (signedInUserError || !signedInUser || signedInUser.is_anonymous) {
            throw new Error(labels.errorFallback);
          }

          router.replace(
            `/tool/organizations/claim-assessment/${guestAssessmentId}`,
          );
          router.refresh();
          return;
        }

        setConfirmationEmail(email);
        return;
      }

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
      
      router.push("/auth/login?registered=true");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : labels.errorFallback);
    } finally {
      setIsLoading(false);
    }
  };

  if (confirmationEmail) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#02040E] p-4 md:p-10">
        <div className="pointer-events-none absolute inset-0 z-0 size-full">
          <Image
            src="/images/Startseite.svg"
            alt={labels.backgroundAlt}
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="relative z-10 flex w-full max-w-110.5 flex-col items-start gap-4 font-['Space_Grotesk']">
          <div className="flex h-16 items-center">
            <Image
              src="/images/Logo-weiß.svg"
              alt="complyX Logo"
              width={180}
              height={48}
              priority
              className="object-contain"
            />
          </div>
          <div className="flex self-stretch flex-col gap-2 pb-4">
            <h1 className="text-4xl font-medium tracking-tight text-white">
              E-Mail bestätigen
            </h1>
            <p className="text-base text-white/80">
              Öffnen Sie den Bestätigungslink in diesem Browser.
            </p>
          </div>
          <div className="self-stretch rounded-2xl bg-[#FAFAFA] p-8 text-black">
            Wir haben einen Bestätigungslink an{" "}
            <strong>{confirmationEmail}</strong> gesendet. Danach wird Ihr
            Schnellcheck mit einer Organisation Ihrer Wahl verknüpft.
          </div>
        </div>
      </div>
    );
  }

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
            
            {!guestAssessmentId ? (
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
            ) : null}

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
              guestAssessmentId
                ? `/check/${guestAssessmentId}/claim`
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
