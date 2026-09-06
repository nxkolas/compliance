import { AppShell } from "@/components/app-shell";
import { getDictionary } from "@/src/i18n";
import { requireAuth } from "@/src/supabase/require-auth";
import { connection } from "next/server";
import type { ReactNode } from "react";

type SimpleAppPageProps = {
  title: string;
  children: ReactNode;
};

export async function SimpleAppPage({ title, children }: SimpleAppPageProps) {
  await connection();
  await requireAuth();
  const dictionary = await getDictionary();

  return (
    <AppShell dictionary={dictionary}>
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">{title}</h1>
        <div className="flex flex-col gap-3 text-muted-foreground">
          {children}
        </div>
      </section>
    </AppShell>
  );
}
