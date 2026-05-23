"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";
import type { SelfCheckAssessmentDto } from "@/src/server/organizations/types";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AssessmentCreateFormProps = {
  organizationId: string;
  labels: Dictionary["assessment"];
};

type SerializedAssessment = SerializeDates<SelfCheckAssessmentDto>;

type RequestState = {
  message: string | null;
  tone: "default" | "success" | "error";
};

type SerializeDates<T> = {
  [K in keyof T]: T[K] extends null
    ? null
    : T[K] extends Date
      ? string
      : T[K] extends Date | null
        ? string | null
        : T[K] extends object
          ? SerializeDates<T[K]>
          : T[K];
};

export function AssessmentCreateForm({
  organizationId,
  labels,
}: AssessmentCreateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState<string>(labels.defaultTitle);
  const [isCreatingAssessment, setIsCreatingAssessment] = useState(false);
  const [notice, setNotice] = useState<RequestState>({
    message: null,
    tone: "default",
  });

  async function handleCreateAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingAssessment(true);
    setNotice({ message: null, tone: "default" });

    try {
      const response = await fetch(
        `/api/organizations/${organizationId}/assessments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        },
      );

      const body = (await response.json()) as {
        assessment?: SerializedAssessment;
        error?: string;
      };

      if (!response.ok || !body.assessment) {
        throw new Error(body.error ?? labels.createError);
      }

      router.push(`/tool/assessments/${body.assessment.id}`);
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : labels.createErrorFallback,
        tone: "error",
      });
    } finally {
      setIsCreatingAssessment(false);
    }
  }

  return (
    <div className="grid gap-4">
      {notice.message && (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            notice.tone === "success" &&
              "border-emerald-200 bg-emerald-50 text-emerald-900",
            notice.tone === "error" &&
              "border-red-200 bg-red-50 text-red-900",
          )}
        >
          {notice.message}
        </div>
      )}

      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle>{labels.createTitle}</CardTitle>
          <CardDescription>
            {labels.createDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleCreateAssessment}>
            <div className="grid gap-2">
              <Label htmlFor="assessment-title">{labels.titleLabel}</Label>
              <Input
                id="assessment-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={labels.defaultTitle}
                required
              />
            </div>
            <Button type="submit" disabled={isCreatingAssessment}>
              {isCreatingAssessment ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ClipboardCheck />
              )}
              {isCreatingAssessment ? labels.createPending : labels.createButton}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
