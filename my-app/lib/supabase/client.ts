import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for browser components.
 */
export function createClient() {
  const configuration = window.__COMPLIANCETOOL_CONFIG__;
  if (!configuration) {
    throw new Error("Browser Supabase configuration is unavailable");
  }
  return createBrowserClient(
    configuration.supabaseUrl,
    configuration.supabasePublishableKey,
  );
}

declare global {
  interface Window {
    __COMPLIANCETOOL_CONFIG__?: {
      supabaseUrl: string;
      supabasePublishableKey: string;
    };
  }
}
