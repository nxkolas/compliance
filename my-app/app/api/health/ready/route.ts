import { checkDatabaseReadiness } from "@/src/server/platform/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkDatabaseReadiness();

    return Response.json(
      {
        status: "ready",
        service: "web",
      },
      {
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  } catch {
    return Response.json(
      {
        status: "not_ready",
        service: "web",
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }
}
