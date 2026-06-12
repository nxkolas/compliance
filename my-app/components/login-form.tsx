"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
      router.replace(getNextPath());
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : labels.errorFallback);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("w-full max-w-110.5 px-4 flex flex-col justify-start items-start gap-4 font-['Space_Grotesk']", className)} {...props}>
      
      {/* LOGO-BEREICH */}
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
          {labels.signInDescription}
        </p>
      </div>

      {/* DIE WEISSE LOGIN-CARD - ERZWUNGEN OHNE SCHATTEN */}
      <div className="self-stretch p-9 bg-[#FAFAFA] rounded-2xl shadow-none flex flex-col justify-start items-start gap-6 border-0">
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
                className="auth-input w-full h-12 pl-12 pr-4 text-black text-base font-normal focus-visible:ring-2 focus-visible:ring-[#002AFF] placeholder:text-[#4A5565] shadow-none"
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
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input w-full h-12 pl-12 pr-12 text-black text-base font-normal focus-visible:ring-2 focus-visible:ring-[#002AFF] placeholder:text-[#4A5565] shadow-none"
              />
              <button
                type="button"
                aria-label={showPassword ? labels.hidePassword : labels.showPassword}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#002AFF] transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>

          {/* ANGEMELDET BLEIBEN */}
          <div className="self-stretch flex justify-start items-center gap-2">
            <input 
              type="checkbox" 
              id="remember"
              className="auth-checkbox size-5 cursor-pointer shadow-none"
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
            className="w-full h-12 bg-[#002AFF] hover:bg-[#0022cc] text-white text-base font-medium rounded-lg transition-colors shadow-none"
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
