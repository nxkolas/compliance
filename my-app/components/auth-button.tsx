import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/src/supabase/server";
import { ProfileMenu } from "./profile-menu";
import { getDictionary, getLocale } from "@/src/i18n";
import { ArrowRight, Building2 } from "lucide-react";

export async function AuthButton() {
  const [dictionary, locale] = await Promise.all([
    getDictionary(),
    getLocale(),
  ]);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = typeof user?.email === "string" ? user.email : null;
  const organizationsLabel = dictionary.organizations.managementTitle;

  return email ? (
    <div className="flex items-center gap-2">
      <Button
        asChild
        size="sm"
        className="group h-10 rounded-lg border-0 bg-[#002BFF] px-3 text-white shadow-[0_6px_18px_rgba(0,43,255,0.32)] transition-all hover:-translate-y-0.5 hover:bg-[#002BFF] hover:shadow-[0_9px_24px_rgba(0,43,255,0.46)] active:translate-y-0 md:px-4"
      >
        <Link href="/tool" aria-label={organizationsLabel}>
          <Building2 className="size-4" />
          <span className="hidden md:inline">{organizationsLabel}</span>
          <ArrowRight className="hidden size-4 transition-transform group-hover:translate-x-0.5 md:block" />
        </Link>
      </Button>

      <ProfileMenu
        email={email}
        locale={locale}
        showPreferences={false}
        labels={{
          common: dictionary.common,
          languages: dictionary.languages,
          profile: dictionary.profile,
          sidebar: dictionary.sidebar,
        }}
      />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button
        asChild
        size="sm"
        variant="outline"
        className="h-10 w-36 rounded-lg border-white/70 bg-[linear-gradient(135deg,rgba(0,43,255,0.16),rgba(255,255,255,0.03))] text-white/95 shadow-[0_4px_16px_rgba(0,43,255,0.18)] transition-all hover:-translate-y-0.5 hover:border-white hover:bg-[linear-gradient(135deg,rgba(0,43,255,0.26),rgba(255,255,255,0.06))] hover:text-white hover:shadow-[0_7px_20px_rgba(0,43,255,0.28)] active:translate-y-0"
      >
        <Link href="/auth/login">{dictionary.common.signIn}</Link>
      </Button>
      <Button
        asChild
        size="sm"
        className="h-10 w-36 rounded-lg border-0 bg-[#002BFF] text-white shadow-[0_6px_18px_rgba(0,43,255,0.32)] transition-all hover:-translate-y-0.5 hover:bg-[#002BFF] hover:shadow-[0_9px_24px_rgba(0,43,255,0.46)] active:translate-y-0"
      >
        <Link href="/auth/sign-up">{dictionary.common.signUp}</Link>
      </Button>
    </div>
  );
}
