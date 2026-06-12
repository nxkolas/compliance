import { GuestShell } from "@/components/guest/guest-shell";
import { GuestStartForm } from "@/components/guest/guest-start-form";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

export default function GuestCheckPage() {
  return (
    <Suspense fallback={null}>
      <GuestCheckContent />
    </Suspense>
  );
}

async function GuestCheckContent() {
  const dictionary = await getDictionary();
  const labels = dictionary.guestCheck;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = supabaseUrl
    ? new URL(supabaseUrl).hostname.split(".")[0]
    : undefined;

  return (
    <GuestShell
      title={labels.start.title}
      description={labels.start.description}
      labels={labels.shell}
    >
      <GuestStartForm
        labels={labels.start}
        turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        supabaseAuthSettingsUrl={
          projectRef
            ? `https://supabase.com/dashboard/project/${projectRef}/auth/providers`
            : undefined
        }
      />
    </GuestShell>
  );
}
