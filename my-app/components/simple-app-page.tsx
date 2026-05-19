import { AppNavigation } from "@/components/app-navigation";
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 p-8">
      <AppNavigation />
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold">{title}</h1>
        <div className="flex flex-col gap-3 text-muted-foreground">
          {children}
        </div>
      </section>
    </main>
  );
}
