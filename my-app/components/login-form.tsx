"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import { Lock, Mail } from "lucide-react";
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
      <Card>
        <CardHeader className="space-y-3">
          <div className="text-2xl font-semibold">
            comply<span className="text-primary">X</span>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl">{labels.welcomeBack}</CardTitle>
            <CardDescription>{labels.signInContinue}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">{labels.email}</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">{labels.password}</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="********"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input accent-primary"
                  />
                  {labels.keepSignedIn}
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {labels.forgotPassword}
                </Link>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? labels.signingIn : labels.login}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        {labels.noAccount}{" "}
        <Link
          href="/auth/sign-up"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {labels.signUp}
        </Link>
      </div>
    </div>
  );
}


