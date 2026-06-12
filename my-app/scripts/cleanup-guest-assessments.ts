import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { and, eq, lt } from "drizzle-orm";
import { db } from "../src/db";
import {
  guestAssessmentSessions,
  organizations,
} from "../src/db/schema";

async function cleanup() {
  const expired = await db.query.guestAssessmentSessions.findMany({
    where: and(
      eq(guestAssessmentSessions.status, "active"),
      lt(guestAssessmentSessions.expiresAt, new Date()),
    ),
  });

  if (expired.length === 0) {
    console.log("No expired guest assessments found.");
    return;
  }

  for (const session of expired) {
    await db.transaction(async (tx) => {
      await tx
        .update(guestAssessmentSessions)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(guestAssessmentSessions.id, session.id));
      await tx
        .delete(organizations)
        .where(eq(organizations.id, session.organizationId));
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const session of expired) {
      const { error } = await admin.auth.admin.deleteUser(
        session.anonymousUserId,
      );
      if (error) {
        console.warn(
          `Could not delete anonymous auth user ${session.anonymousUserId}: ${error.message}`,
        );
      }
    }
  } else {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY is not set; app data was removed but anonymous auth users were retained.",
    );
  }

  console.log(`Removed ${expired.length} expired guest assessment(s).`);
}

cleanup().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
