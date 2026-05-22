import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-[#020612] px-6 py-12 md:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 size-[460px] rounded-full bg-[#003BFF]/25 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-44 -left-40 size-[520px] rounded-full bg-[#003BFF]/20 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          background:
            "radial-gradient(ellipse 50% 100% at 50% 50%, #002BFF 0%, rgba(0, 0, 0, 0) 0%, #002EEF 0%), linear-gradient(90deg, #002EEF 0%, #002EEF 0%, #002EEF 0%)",
        }}
      >
        <div className="absolute bottom-0 right-[30%] size-[100px] bg-[#D9D9D9]" />
      </div>
      <div className="relative z-10 w-full max-w-[400px]">
        <LoginForm />
      </div>
    </main>
  );
}
