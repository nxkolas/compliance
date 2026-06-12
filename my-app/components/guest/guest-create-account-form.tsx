"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";

export function GuestCreateAccountForm({
  assessmentId,
}: {
  assessmentId: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const supabase = createClient();
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user?.is_anonymous) {
        throw new Error("Die anonyme Sitzung ist nicht mehr verfügbar.");
      }

      const next = `/check/${assessmentId}/set-password`;
      const { error: updateError } = await supabase.auth.updateUser(
        {
          email,
          data: { full_name: name },
        },
        {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
        },
      );
      if (updateError) throw updateError;
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Das Konto konnte nicht vorbereitet werden.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-white/15 bg-[#111522]/95 p-8">
        <h2 className="text-xl font-semibold">E-Mail bestätigen</h2>
        <p className="mt-3 leading-7 text-white/65">
          Wir haben einen Bestätigungslink an <strong>{email}</strong> gesendet.
          Öffnen Sie ihn in diesem Browser, um ein Passwort festzulegen und das
          Ergebnis zu sichern.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-white/15 bg-[#111522]/95 p-6 sm:p-8"
    >
      <div className="grid gap-5">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>
      {error ? (
        <div className="mt-4 text-sm text-red-300">
          <p>{error}</p>
          <Link
            href={`/check/${assessmentId}/claim`}
            className="mt-2 inline-block underline"
          >
            Bestehendes Konto verwenden
          </Link>
        </div>
      ) : null}
      <Button type="submit" size="lg" className="mt-6 w-full" disabled={loading}>
        {loading ? "Bestätigung wird gesendet..." : "E-Mail bestätigen"}
      </Button>
    </form>
  );
}
