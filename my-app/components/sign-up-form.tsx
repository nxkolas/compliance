"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, User, Eye, EyeOff } from "lucide-react"; // Auge-Icons importiert
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image"; // Next.js Image Import für die SVGs

export function SignUpForm({
  labels,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  labels: Record<string, string | undefined>; 
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // States für die Sichtbarkeit der Passwörter
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      setIsLoading(false);
      return;
    }

    if (!acceptTerms) {
      setError("Bitte akzeptieren Sie die Nutzungsbedingungen.");
      setIsLoading(false);
      return;
    }

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });
      if (signUpError) throw signUpError;
      
      router.push("/auth/login?registered=true");
    } catch (err: unknown) {
      // Behebt den eslint(no-explicit-any) Fehler typsicher
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    /* Der Hauptbildschirm: Nutzt euer dunkles Blau, zentriert den Inhalt und versteckt Überhänge */
    <div className="relative min-h-screen w-full bg-[#02040E] flex items-center justify-center overflow-hidden p-4 md:p-10">
      
      {/* HINTERGRUND: Genau wie bei der Login-Seite lädt das eure Startseite.svg */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <Image 
          src="/images/Startseite.svg"
          alt="Hintergrund" 
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* FORMULAR-CONTAINER: z-10 sorgt dafür, dass die Karte über dem SVG liegt */}
      <div className={cn("relative z-10 w-full max-w-[442px] flex flex-col justify-start items-start gap-4 font-['Space_Grotesk']", className)} {...props}>
        
        {/* LOGO-BEREICH (Behebt die automatische Höhenwarnung in der Konsole) */}
        <div className="h-16 flex items-center justify-start">
          <Image 
            src="/images/Logo-weiß.svg"
            alt="complyX Logo"
            width={180}
            height={48}
            priority 
            style={{ height: 'auto', width: '180px' }}
            className="object-contain"
          />
        </div>

        {/* TITEL & SUBTITEL */}
        <div className="self-stretch pb-4 flex flex-col justify-start items-start gap-2">
          <h1 className="text-white text-4xl font-medium tracking-tight">
            Konto erstellen
          </h1>
          <p className="text-white/80 text-base font-normal">
            Erstellen Sie Ihr Konto, um zu beginnen.
          </p>
        </div>

        {/* DIE WEISSE CARD */}
        <div className="self-stretch p-8 bg-[#FAFAFA] rounded-2xl shadow-[0px_8px_32px_-4px_rgba(0,0,0,0.10)] flex flex-col justify-start items-start gap-6">
          <form onSubmit={handleSignUp} className="w-full flex flex-col gap-5">
            
            {/* NAME FELD */}
            <div className="self-stretch flex flex-col justify-start items-start gap-2">
              <Label htmlFor="name" className="text-black text-base font-medium">
                Name
              </Label>
              <div className="relative w-full">
                <User className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#002AFF]" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Max Mustermann"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-white text-black text-base font-normal rounded-lg border border-gray-200 focus-visible:ring-2 focus-visible:ring-[#002AFF] placeholder:text-[#4A5565]"
                />
              </div>
            </div>

            {/* E-MAIL FELD */}
            <div className="self-stretch flex flex-col justify-start items-start gap-2">
              <Label htmlFor="email" className="text-black text-base font-medium">
                {labels?.email || "E-Mail"}
              </Label>
              <div className="relative w-full">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#002AFF]" />
                <Input
                  id="email"
                  type="email"
                  placeholder="ihre@email.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-white text-black text-base font-normal rounded-lg border border-gray-200 focus-visible:ring-2 focus-visible:ring-[#002AFF] placeholder:text-[#4A5565]"
                />
              </div>
            </div>

            {/* PASSWORT FELD */}
            <div className="self-stretch flex flex-col justify-start items-start gap-2">
              <Label htmlFor="password" className="text-black text-base font-medium">
                {labels?.password || "Passwort"}
              </Label>
              <div className="relative w-full">
                <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#002AFF]" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"} // Schaltet Typ um
                  placeholder="Min. 10 Zeichen, mind. 1 Zahl"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-12 pr-12 bg-white text-black text-base font-normal rounded-lg border border-gray-200 focus-visible:ring-2 focus-visible:ring-[#002AFF] placeholder:text-[#4A5565]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#002AFF] transition-colors focus:outline-none"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            {/* PASSWORT BESTÄTIGEN FELD */}
            <div className="self-stretch flex flex-col justify-start items-start gap-2">
              <Label htmlFor="confirmPassword" className="text-black text-base font-medium">
                Passwort bestätigen
              </Label>
              <div className="relative w-full">
                <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#002AFF]" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"} // Schaltet Typ um
                  placeholder="Passwort wiederholen"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-12 pl-12 pr-12 bg-white text-black text-base font-normal rounded-lg border border-gray-200 focus-visible:ring-2 focus-visible:ring-[#002AFF] placeholder:text-[#4A5565]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#002AFF] transition-colors focus:outline-none"
                >
                  {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            {/* NUTZUNGSBEDINGUNGEN CHECKBOX */}
            <div className="self-stretch flex justify-start items-start gap-2 pt-1">
              <input 
                type="checkbox" 
                id="terms"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="size-5 mt-0.5 bg-white rounded-sm border border-gray-200 accent-[#002AFF] cursor-pointer shrink-0" 
              />
              <label htmlFor="terms" className="text-[#4A5565] text-sm font-normal cursor-pointer select-none leading-tight">
                Ich akzeptiere die{" "}
                <Link href="/terms" className="text-[#002AFF] hover:underline">Nutzungsbedingungen</Link>
                {" "}und die{" "}
                <Link href="/privacy" className="text-[#002AFF] hover:underline">Datenschutzerklärung</Link>.
              </label>
            </div>

            {/* FEHLERMELDUNG */}
            {error && <p className="text-sm text-destructive font-medium">{error}</p>}

            {/* BUTTON */}
            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full h-12 bg-[#002AFF] hover:bg-[#0022cc] text-white text-base font-medium rounded-lg transition-colors mt-2"
            >
              {isLoading ? "Wird erstellt..." : "Konto erstellen"}
            </Button>
          </form>
        </div>

        {/* FOOTER */}
        <div className="self-stretch flex justify-center items-center gap-1 mt-2 text-white text-base">
          <span className="font-normal">Bereits ein Konto?</span>
          <Link href="/auth/login" className="font-semibold hover:underline decoration-2 text-white">
            Anmelden
          </Link>
        </div>

      </div>
    </div>
  );
}