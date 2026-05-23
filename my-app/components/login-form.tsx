"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function getNextPath() {
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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.replace(getNextPath());
      router.refresh();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : labels.errorFallback);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("w-full", className)} {...props}>
      <div className="mb-12 text-left text-white">
        <p className="mb-2 text-[28px] font-normal leading-none tracking-normal">
          comply<span className="font-semibold text-[#003BFF]">X</span>
        </p>
        <h1 className="text-[34px] font-semibold leading-tight tracking-normal">
          {labels.welcomeBack}
        </h1>
        <p className="mt-2 text-base font-normal text-white/90">
          {labels.signInContinue}
        </p>
      </div>

      <Card className="border-0 bg-[#f1f1f1] text-[#111111] shadow-2xl shadow-black/30">
        <CardContent className="p-8">
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="email" className="text-base font-semibold">
                  {labels.email}
                </Label>
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#003BFF]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-[52px] rounded-lg border-[#cfcfcf] bg-transparent pl-12 pr-4 text-base text-[#111111] shadow-none placeholder:text-[#111111] focus-visible:ring-[#003BFF]"
                  />
                </div>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="password" className="text-base font-semibold">
                  {labels.password}
                </Label>
                <div className="relative">
                  <LockIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#003BFF]" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="********"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-[52px] rounded-lg border-[#cfcfcf] bg-transparent pl-12 pr-4 text-base text-[#111111] shadow-none placeholder:text-[#111111] focus-visible:ring-[#003BFF]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 text-[13px] font-semibold">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-[#bdbdbd] accent-[#003BFF]"
                  />
                  {labels.keepSignedIn}
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-[#003BFF] underline-offset-4 hover:underline"
                >
                  {labels.forgotPassword}
                </Link>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                className="h-12 w-full rounded-lg bg-[#073BFF] text-base font-semibold text-white shadow-none hover:bg-[#002EEF]"
                disabled={isLoading}
              >
                {isLoading ? labels.signingIn : labels.login}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-9 text-center text-base text-white/90">
        {labels.noAccount}{" "}
        <Link href="/auth/sign-up" className="font-semibold text-white">
          {labels.signUp}
        </Link>
      </div>
    </div>
  );
}

function MailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect width="18" height="14" x="3" y="5" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}


