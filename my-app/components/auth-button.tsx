import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { getDictionary } from "@/lib/i18n";

export async function AuthButton() {
  const dictionary = await getDictionary();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = typeof user?.email === "string" ? user.email : null;

  return email ? (
    <div className="flex items-center gap-4">
      {dictionary.common.signedInAs} {email}
      <LogoutButton>{dictionary.common.logout}</LogoutButton>
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">{dictionary.common.signIn}</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">{dictionary.common.signUp}</Link>
      </Button>
    </div>
  );
}
