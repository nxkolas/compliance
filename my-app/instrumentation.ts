import { installPdfPolyfills } from "@/src/server/pdf-polyfills";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    installPdfPolyfills();
    const { getWebEnvironment } = await import("@/src/config/env/web");
    getWebEnvironment();
  }
}
