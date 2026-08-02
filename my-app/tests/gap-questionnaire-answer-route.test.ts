import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  revalidatePath: vi.fn(),
  saveQuestionnaireDraftAnswer: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/src/server/api/auth", () => ({ requireApiUser: mocks.requireApiUser }));
vi.mock("@/src/server/gap-analysis", () => ({
  saveQuestionnaireDraftAnswer: mocks.saveQuestionnaireDraftAnswer,
}));

import { PATCH } from "@/app/api/organizations/[organizationId]/gap-analysis/questionnaire-draft/answers/[questionKey]/route";

describe("Gap questionnaire draft answer route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
    });
    mocks.saveQuestionnaireDraftAnswer.mockResolvedValue({ answer: {} });
  });

  it("accepts a stable Gap question key in the route", async () => {
    const response = await PATCH(
      new Request(
        "http://localhost/api/organizations/3782a4c2-9a74-4ec9-a85b-0d0341ff3a0a/gap-analysis/questionnaire-draft/answers/gap.governance.security_owner",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            draftId: "ff153909-8fe6-4c95-b436-ce1c87d2b015",
            optionId: "yes",
          }),
        },
      ),
      {
        params: Promise.resolve({
          organizationId: "3782a4c2-9a74-4ec9-a85b-0d0341ff3a0a",
          questionKey: "gap.governance.security_owner",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.saveQuestionnaireDraftAnswer).toHaveBeenCalledWith({
      userId: "00000000-0000-4000-8000-000000000001",
      organizationId: "3782a4c2-9a74-4ec9-a85b-0d0341ff3a0a",
      questionId: "gap.governance.security_owner",
      draftId: "ff153909-8fe6-4c95-b436-ce1c87d2b015",
      optionId: "yes",
    });
  });
});
