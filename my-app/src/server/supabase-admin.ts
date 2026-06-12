import { createClient } from "@supabase/supabase-js";

export async function deleteAuthUserIfConfigured(userId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return;

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.warn(`Could not delete Supabase Auth user ${userId}: ${error.message}`);
  }
}
