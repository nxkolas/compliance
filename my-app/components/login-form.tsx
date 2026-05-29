"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import { Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
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
    <div className={cn("w-full max-w-442px px-4 flex flex-col justify-start items-start gap-4 font-['Space_Grotesk']", className)} {...props}>
      
      {/* 1. HIER REIN: Ersetze den alten Logo-Text mit diesem Block */}
      <div className="h-16 flex items-center justify-start">
        <Image 
          src="/images/Logo-weiß.svg"
          alt="complyX Logo"
          width={180}
          height={48}
          priority 
          className="object-contain"
        />
      </div>

      {/* TITEL & SUBTITEL */}
      <div className="self-stretch pb-4 flex flex-col justify-start items-start gap-2">
        <h1 className="text-neutral-50 text-4xl font-medium tracking-tight">
          {labels.welcomeBack}
        </h1>
        <p className="text-neutral-50/80 text-base font-normal">
          Melden Sie sich an, um fortzufahren.
        </p>
      </div>

      {/* DIE WEISSE LOGIN-CARD */}
      <div className="self-stretch p-9 bg-[#FAFAFA] rounded-2xl shadow-[0px_8px_32px_-4px_rgba(0,0,0,0.10)] flex flex-col justify-start items-start gap-6">
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-6">
          
          {/* E-MAIL FELD */}
          <div className="self-stretch flex flex-col justify-start items-start gap-2">
            <Label htmlFor="email" className="text-black text-base font-medium">
              {labels.email}
            </Label>
            <div className="relative w-full">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#002AFF]" />
              <Input
                id="email"
                type="email"
                placeholder="ihre@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-white text-black text-base font-normal rounded-lg border border-gray-200 focus-visible:ring-2 focus-visible:ring-[#002AFF] placeholder:text-[#4A5565]"
              />
            </div>
          </div>

          {/* PASSWORT FELD */}
          <div className="self-stretch flex flex-col justify-start items-start gap-2">
            <div className="self-stretch flex justify-between items-center">
              <Label htmlFor="password" className="text-black text-base font-medium">
                {labels.password}
              </Label>
              <Link 
                href="/auth/forgot-password" 
                className="text-[#002AFF] text-sm font-medium hover:underline"
              >
                {labels.forgotPassword}
              </Link>
            </div>
            <div className="relative w-full">
              <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#002AFF]" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-white text-black text-base font-normal rounded-lg border border-gray-200 focus-visible:ring-2 focus-visible:ring-[#002AFF] placeholder:text-[#4A5565]"
              />
            </div>
          </div>

          {/* ANGEMELDET BLEIBEN */}
          <div className="self-stretch flex justify-start items-center gap-2">
            <input 
              type="checkbox" 
              id="remember"
              className="size-5 bg-white rounded-sm border border-gray-200 accent-[#002AFF] cursor-pointer" 
            />
            <label htmlFor="remember" className="text-gray-950 text-base font-medium cursor-pointer select-none">
              {labels.keepSignedIn}
            </label>
          </div>

          {/* FEHLERMELDUNG */}
          {error && <p className="text-sm text-destructive font-medium">{error}</p>}

          {/* BUTTON */}
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full h-12 bg-[#002AFF] hover:bg-[#0022cc] text-white text-base font-medium rounded-lg transition-colors"
          >
            {isLoading ? labels.signingIn : labels.login}
          </Button>
        </form>
      </div>

      {/* FOOTER */}
      <div className="self-stretch flex justify-center items-center gap-1 mt-2 text-white text-base">
        <span className="font-normal">{labels.noAccount}</span>
        <Link href="/auth/sign-up" className="font-bold hover:underline decoration-2">
          {labels.signUp}
        </Link>
      </div>

    </div>
  );
}