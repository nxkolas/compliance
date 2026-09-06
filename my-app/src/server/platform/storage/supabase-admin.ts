import { createClient } from "@supabase/supabase-js";
import { getInternalSupabaseEnvironment } from "@/src/config/env/supabase";

export function getSupabaseAdminClient() {
  const url = getInternalSupabaseEnvironment().url;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service-role storage is not configured");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function deleteAuthUserIfConfigured(userId: string) {
  const url = getInternalSupabaseEnvironment().url;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceRoleKey) return;

  const admin = getSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.warn(`Could not delete Supabase Auth user ${userId}: ${error.message}`);
  }
}
