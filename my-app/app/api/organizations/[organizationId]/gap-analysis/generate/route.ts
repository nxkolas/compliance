import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getLocale } from "@/lib/i18n";
import { requireApiUser } from "@/src/server/api/auth";
import { getErrorResponse } from "@/src/server/api/errors";
import { readJsonBody } from "@/src/server/api/request";
import { generateGapAnalysis } from "@/src/server/gap-analysis/generation-service";
import { gapGenerationRequestSchema } from "@/src/server/gap-analysis/validation";

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const user = await requireApiUser();
    const { organizationId } = await context.params;
    const body = await readJsonBody(request, gapGenerationRequestSchema);
    const result = await generateGapAnalysis({ userId: user.id, organizationId, locale: await getLocale(), ...body });
    revalidatePath(`/tool/organizations/${organizationId}/gap-analysis`);
    return NextResponse.json({ result });
  } catch (error) {
    const response = getErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
