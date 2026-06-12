import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { parseInput } from "@/src/server/api/request";
import { GuestAssessmentPdf } from "@/src/server/guest-assessments/pdf";
import {
  getGuestAssessment,
  guestClaimCookieName,
} from "@/src/server/guest-assessments/service";
import { guestAssessmentIdSchema } from "@/src/server/guest-assessments/validation";
import { renderToBuffer } from "@react-pdf/renderer";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ assessmentId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireApiUser();
    const { assessmentId } = await context.params;
    const cookieStore = await cookies();
    const assessment = await getGuestAssessment(
      user,
      parseInput(guestAssessmentIdSchema, assessmentId, "Invalid assessmentId"),
      cookieStore.get(guestClaimCookieName)?.value,
    );
    if (assessment.run.status !== "completed") {
      return NextResponse.json(
        { error: "Complete the assessment before exporting" },
        { status: 409 },
      );
    }

    const buffer = await renderToBuffer(
      GuestAssessmentPdf({ assessment }),
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="nis2-schnellcheck-${assessmentId}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
