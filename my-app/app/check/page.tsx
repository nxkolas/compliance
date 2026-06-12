import { GuestShell } from "@/components/guest/guest-shell";
import { GuestStartForm } from "@/components/guest/guest-start-form";

export default function GuestCheckPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = supabaseUrl
    ? new URL(supabaseUrl).hostname.split(".")[0]
    : undefined;

  return (
    <GuestShell
      title="NIS2 Schnellcheck"
      description="Beantworten Sie sechs kurze Fragen und erhalten Sie eine erste, unverbindliche Einschätzung. Ein Konto ist dafür nicht erforderlich."
    >
      <GuestStartForm
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
