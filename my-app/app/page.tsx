import { AuthButton } from "@/components/auth-button";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <PublicLanguageSwitcher showThemeSwitcher />
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const dictionary = await getDictionary();
  const productLinks = dictionary.home.productLinks.map((link) => ({
    ...link,
    href: "/tool/organizations",
  }));
  const metrics = [
    { value: "6", label: dictionary.home.metrics.modules },
    { value: "1", label: dictionary.home.metrics.workflow },
    { value: "NIS2", label: dictionary.home.metrics.focus },
  ];

  return (
    <main className="min-h-screen bg-transparent">
      <header className="border-b bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-sm font-semibold">
            {dictionary.home.brand}
          </Link>
          {hasEnvVars ? (
            <Suspense>
              <AuthButton />
            </Suspense>
          ) : (
            <p className="text-sm text-muted-foreground">
              {dictionary.common.supabaseMissing}
            </p>
          )}
        </div>
      </header>

      <section className="border-b">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div className="flex flex-col gap-7">
            <div className="flex w-fit rounded-lg border bg-muted px-3 py-1 text-sm text-muted-foreground">
              {dictionary.home.eyebrow}
            </div>
            <div className="flex flex-col gap-5">
              <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
                {dictionary.home.brand}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[#002BFF] dark:text-muted-foreground">
                {dictionary.home.heroDescription}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/tool/organizations">
                  {dictionary.home.dashboardCta}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/check/applicability">
                  {dictionary.home.selfCheckCta}
                </Link>
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
                  <p className="text-sm font-medium">
                    {dictionary.home.statusTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dictionary.home.statusSubtitle}
                  </p>
                </div>
                <div className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                  {dictionary.home.active}
                </div>
              </div>
              <div className="grid gap-3 p-4">
                {productLinks.slice(0, 4).map((link, index) => (
                  <div
                    key={link.label}
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
            <h2 className="text-2xl font-semibold">
              {dictionary.home.modulesTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {dictionary.home.modulesDescription}
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/auth/sign-up">{dictionary.home.createAccount}</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productLinks.map((link) => (
            <Card key={link.label} className="rounded-lg shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg">{link.label}</CardTitle>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {link.tag}
                  </span>
                </div>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}

function HomeFallback() {
  return <main className="min-h-screen bg-transparent" />;
}
