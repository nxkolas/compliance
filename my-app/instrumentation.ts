export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getWebEnvironment } = await import("@/src/config/env/web");
    getWebEnvironment();
  }
}
