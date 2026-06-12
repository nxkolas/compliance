import Link from "next/link";
import type { ReactNode } from "react";

export function GuestShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-semibold text-white">
            complyX
          </Link>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
            Ohne Konto
          </span>
        </header>
        <section className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            {title}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-white/70">
            {description}
          </p>
        </section>
        {children}
      </div>
    </main>
  );
}
