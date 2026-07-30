import { LoginForm } from "../../../components/login-form"; // Mit geschweiften Klammern!
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";
import Image from "next/image";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";

export default function Page() {
  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-background p-4">
      <Suspense fallback={null}>
        <PublicLanguageSwitcher />
      </Suspense>
      
{/* HINTERGRUND: Der Pfad zeigt jetzt genau in den images-Ordner */}
<div className="absolute inset-0 z-0 pointer-events-none">
  <Image 
    src="/images/Startseite.svg" // <-- Hier "/images/" davor packen und das große "S" beachten!
    alt=""
    fill
    className="pointer-events-none object-cover"
    priority
  />
</div>

      {/* VORDERGRUND: Die Maske schwebt darüber */}
      <div className="relative z-10 w-full max-w-[476px]">
        <Suspense fallback={null}>
          <LoginFormLoader />
        </Suspense>
      </div>
    </main>
  );
}

async function LoginFormLoader() {
  const dictionary = await getDictionary();

  return <LoginForm labels={dictionary.auth} />;
}
