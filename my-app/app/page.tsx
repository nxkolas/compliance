import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-4 border-b pb-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-semibold">
            NIS2 Compliance Checker
          </Link>
          {hasEnvVars ? (
            <Suspense>
              <AuthButton />
            </Suspense>
          ) : (
            <p className="text-sm">Supabase environment variables missing.</p>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold">NIS2 Compliance Checker</h1>
          <p className="mt-2 text-muted-foreground">
            Startpunkt fuer Betroffenheitspruefung, Requirements, Risiko- und
            Registrierungsarbeit.
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Public links</h2>
        <Link href="/auth/login" className="underline">
          Login
        </Link>
        <Link href="/auth/sign-up" className="underline">
          Sign up
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Protected app pages</h2>
        <Link href="/dashboard" className="underline">
          Dashboard
        </Link>
        <Link href="/self-check" className="underline">
          Self-check
        </Link>
        <Link href="/requirements" className="underline">
          Requirements
        </Link>
        <Link href="/risk-management" className="underline">
          Risk management
        </Link>
        <Link href="/suppliers" className="underline">
          Suppliers
        </Link>
        <Link href="/registration" className="underline">
          Registration
        </Link>
      </section>
    </main>
  );
}
