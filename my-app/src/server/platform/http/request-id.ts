import { requestIdSchema } from "@/src/contracts/common/envelopes";

export function resolveRequestId(request: Pick<Request, "headers">) {
  const supplied = request.headers.get("x-request-id");
  const parsed = requestIdSchema.safeParse(supplied);
  return parsed.success ? parsed.data : crypto.randomUUID();
}
