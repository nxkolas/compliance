import { AppShell } from "@/components/app-shell";
import { requireAuth } from "@/lib/supabase/require-auth";
import { connection } from "next/server";
import type { ReactNode } from "react";

type SimpleAppPageProps = {
  title: string;
  children: ReactNode;
};

export async function SimpleAppPage({ title, children }: SimpleAppPageProps) {
  await connection();
  await requireAuth();

  return (
    <AppShell>
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">{title}</h1>
        <div className="flex flex-col gap-3 text-muted-foreground">
          {children}
        </div>
      </section>
    </AppShell>
  );
}
