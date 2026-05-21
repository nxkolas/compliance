import { AuthButton } from "@/components/auth-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

const productLinks = [
  {
    href: "/self-check",
    label: "Self-check",
    description:
      "Pruefen Sie Betroffenheit, Sektor und Unternehmensgroesse fuer NIS2.",
    tag: "Start",
  },
  {
    href: "/requirements",
    label: "Requirements",
    description:
      "Sammeln Sie Anforderungen aus Recherche, Interviews und Nachweisen.",
    tag: "Analyse",
  },
  {
    href: "/risk-management",
    label: "Risk management",
    description:
      "Dokumentieren Sie Massnahmen fuer Governance, Technik und Organisation.",
    tag: "Kontrolle",
  },
  {
    href: "/suppliers",
    label: "Suppliers",
    description:
      "Bewerten Sie Zulieferer, Dienstleister und Risiken in der Lieferkette.",
    tag: "Supply chain",
  },
  {
    href: "/registration",
    label: "Registration",
    description:
      "Bereiten Sie den Registrierungsprozess bei MUK/ELSTER und BSI vor.",
    tag: "Meldung",
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    description:
      "Behalten Sie Status, offene Aufgaben und naechste Schritte im Blick.",
    tag: "Ueberblick",
  },
];

const metrics = [
  { value: "6", label: "Produktbereiche" },
  { value: "1", label: "zentraler Workflow" },
  { value: "NIS2", label: "Fokus" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-sm font-semibold">
            NIS2 Compliance Checker
          </Link>
          {hasEnvVars ? (
            <Suspense>
              <AuthButton />
            </Suspense>
          ) : (
            <p className="text-sm text-muted-foreground">
              Supabase environment variables missing.
            </p>
          )}
        </div>
      </header>

      <section className="border-b">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div className="flex flex-col gap-7">
            <div className="flex w-fit rounded-lg border bg-muted px-3 py-1 text-sm text-muted-foreground">
              Compliance workflow fuer NIS2 Vorbereitung
            </div>
            <div className="flex flex-col gap-5">
              <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
                NIS2 Compliance Checker
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                Strukturieren Sie Betroffenheitspruefung, Anforderungen,
                Risikomanagement, Lieferkettenbewertung und Registrierung in
                einem klaren Produktfluss.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/dashboard">Zum Dashboard</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/self-check">Self-check starten</Link>
              </Button>
            </div>
            <div className="grid max-w-xl grid-cols-3 gap-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg border bg-card px-4 py-3"
                >
                  <p className="text-2xl font-semibold">{metric.value}</p>
                  <p className="text-sm text-muted-foreground">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="rounded-md border bg-background">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Compliance status</p>
                  <p className="text-xs text-muted-foreground">
                    Arbeitsbereiche und naechste Schritte
                  </p>
                </div>
                <div className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                  Aktiv
                </div>
              </div>
              <div className="grid gap-3 p-4">
                {productLinks.slice(0, 4).map((link, index) => (
                  <div
                    key={link.href}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-lg border px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{link.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {link.tag}
                      </p>
                    </div>
                    <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${85 - index * 15}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-14">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold">Produktmodule</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Direkte Links in die Bereiche, die den Compliance-Prozess vom
              ersten Check bis zur Registrierung abbilden.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/auth/sign-up">Account erstellen</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productLinks.map((link) => (
            <Card key={link.href} className="rounded-lg shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg">{link.label}</CardTitle>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {link.tag}
                  </span>
                </div>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href={link.href}>Oeffnen</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
