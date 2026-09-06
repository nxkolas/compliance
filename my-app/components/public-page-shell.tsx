import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AuthButton } from "@/components/auth-button";
import { BrandLogo } from "@/components/brand-logo";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";
import type { Dictionary } from "@/src/i18n";
import { hasEnvVars } from "@/src/utils";

export function PublicPageShell({
  dictionary,
  children,
}: {
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const home = dictionary.home;

  return (
    <div className="min-h-screen bg-transparent text-white">
      <main className="dark min-h-screen overflow-hidden bg-transparent text-white">
        <header className="dark fixed inset-x-0 top-0 z-40 h-32 bg-[#02040E]/25 text-white backdrop-blur-md sm:h-28">
          <div className="relative mx-auto flex h-full max-w-[1728px] items-start gap-8 px-4 pt-4 pb-14 sm:items-center sm:px-10 sm:py-0 lg:px-12 xl:px-[72px]">
            <Link href="/" aria-label={home.brand} className="shrink-0">
              <BrandLogo
                alt={home.brand}
                width={203}
                height={66}
                priority
                className="h-auto w-28 sm:w-44 lg:w-[203px]"
              />
            </Link>

            <nav className="ml-auto hidden items-center gap-8 font-sans text-base font-medium text-white lg:flex">
              <Link
                className="transition-all duration-200 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.70)]"
                href="/#nis2"
              >
                {home.navigation.nis2}
              </Link>
              <Link
                className="transition-all duration-200 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.70)]"
                href="/#about"
              >
                {home.navigation.about}
              </Link>
            </nav>

            <div className="absolute top-3 right-4 z-10 flex flex-col items-end gap-3 text-sm xl:static xl:flex-row xl:items-center xl:gap-2">
              <Suspense fallback={null}>
                <PublicLanguageSwitcher
                  showThemeSwitcher
                  compactOnMobile
                  inline
                  className="order-1 xl:order-2"
                />
              </Suspense>
              <div className="order-2 xl:order-1">
                {hasEnvVars ? (  
                  <Suspense fallback={<div className="h-8 w-48" />}>  
                    <AuthButton />  
                  </Suspense>  
                ) : (  
                  <p className="text-xs text-white/60 sm:text-sm">  
                    {dictionary.common.supabaseMissing}  
                  </p>  
                )}
              </div>
            </div>
          </div>
        </header>
        <div aria-hidden="true" className="h-32 sm:h-28" />
        {children}
      </main>
    </div>
  );
}
