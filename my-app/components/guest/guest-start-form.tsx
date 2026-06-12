"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
        },
      ) => string;
    };
  }
}

export function GuestStartForm({
  turnstileSiteKey,
  supabaseAuthSettingsUrl,
}: {
  turnstileSiteKey?: string;
  supabaseAuthSettingsUrl?: string;
}) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string>();
  const [captchaReady, setCaptchaReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [anonymousAuthDisabled, setAnonymousAuthDisabled] = useState(false);

  function renderCaptcha() {
    if (!turnstileSiteKey || !window.turnstile) return;
    window.turnstile.render("#guest-turnstile", {
      sitekey: turnstileSiteKey,
      callback: setCaptchaToken,
      "expired-callback": () => setCaptchaToken(undefined),
    });
    setCaptchaReady(true);
  }

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    setAnonymousAuthDisabled(false);

    try {
      const supabase = createClient();
      const {
        data: { user: existingUser },
      } = await supabase.auth.getUser();

      if (existingUser && !existingUser.is_anonymous) {
        router.push("/tool/organizations");
        return;
      }

      if (!existingUser) {
        const { error: authError } = await supabase.auth.signInAnonymously({
          options: captchaToken ? { captchaToken } : undefined,
        });
        if (authError) {
          if (isAnonymousAuthDisabledError(authError)) {
            setAnonymousAuthDisabled(true);
            throw new Error(
              "Anonyme Anmeldungen sind für dieses Supabase-Projekt noch nicht aktiviert.",
            );
          }
          throw authError;
        }
      }

      const response = await fetch("/api/guest-assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, captchaToken }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Start fehlgeschlagen");

      router.push(`/check/${payload.assessmentId}/questionnaire`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Der Schnellcheck konnte nicht gestartet werden.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {turnstileSiteKey ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          onLoad={renderCaptcha}
        />
      ) : null}
      <form
        onSubmit={start}
        className="rounded-2xl border border-white/15 bg-[#111522]/95 p-6 sm:p-8"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="companyName">Unternehmensname</Label>
          <Input
            id="companyName"
            required
            maxLength={255}
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Beispiel GmbH"
            className="h-11"
          />
          <p className="text-sm text-white/60">
            Ihre Eingaben werden für 30 Tage in diesem Browser gespeichert.
          </p>
        </div>
        {turnstileSiteKey ? (
          <div className="mt-5">
            <div id="guest-turnstile" />
          </div>
        ) : null}
        {error ? (
          <div
            className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"
            role="alert"
          >
            <p>{error}</p>
            {anonymousAuthDisabled ? (
              <p className="mt-2 leading-6">
                Aktivieren Sie in Supabase unter Authentication → Providers →
                Anonymous Sign-Ins die Option „Allow anonymous sign-ins“.
                {supabaseAuthSettingsUrl ? (
                  <>
                    {" "}
                    <a
                      href={supabaseAuthSettingsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium underline underline-offset-2"
                    >
                      Auth-Einstellungen öffnen
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="mt-6 w-full"
          disabled={
            loading ||
            !companyName.trim() ||
            Boolean(turnstileSiteKey && (!captchaReady || !captchaToken))
          }
        >
          {loading ? "Schnellcheck wird gestartet..." : "Schnellcheck starten"}
        </Button>
      </form>
    </>
  );
}

function isAnonymousAuthDisabledError(error: {
  message?: string;
  code?: string;
}) {
  return (
    error.code === "anonymous_provider_disabled" ||
    error.message?.toLowerCase().includes("anonymous sign-ins are disabled") ===
      true
  );
}
