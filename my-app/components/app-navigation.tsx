import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

const appLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/self-check", label: "Self-check" },
  { href: "/requirements", label: "Requirements" },
  { href: "/risk-management", label: "Risk management" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/registration", label: "Registration" },
];

export function AppNavigation() {
  return (
    <header className="flex flex-col gap-4 border-b pb-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/dashboard" className="font-semibold">
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
      <nav className="flex flex-wrap gap-4 text-sm">
        {appLinks.map((link) => (
          <Link key={link.href} href={link.href} className="underline">
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
