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
import type { SelfCheckAssessmentDto } from "@/src/server/organizations/types";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AssessmentCreateFormProps = {
  organizationId: string;
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
}: AssessmentCreateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("NIS2 assessment");
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
        throw new Error(body.error ?? "Assessment could not be created");
      }

      router.push(`/organizations/${organizationId}`);
      router.refresh();
    } catch (error) {
      setNotice({
        message:
          error instanceof Error ? error.message : "Assessment creation failed",
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
          <CardTitle>Create NIS2 assessment</CardTitle>
          <CardDescription>
            Start a new draft assessment for this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleCreateAssessment}>
            <div className="grid gap-2">
              <Label htmlFor="assessment-title">Assessment title</Label>
              <Input
                id="assessment-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="NIS2 assessment"
                required
              />
            </div>
            <Button type="submit" disabled={isCreatingAssessment}>
              {isCreatingAssessment ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ClipboardCheck />
              )}
              Create assessment
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
