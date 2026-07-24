"use client";

import { useState } from "react";
import type * as z from "zod";
import { ShieldCheck, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";
import { localizeUiError } from "@/lib/i18n/errors";
import { organizationAiProviderPolicySchema } from "@/src/contracts/organizations";
import { organizationsClient } from "@/src/client/organizations";
import { useRouter } from "next/navigation";

type Policy = z.infer<typeof organizationAiProviderPolicySchema>;

export function OrganizationAiProviderPolicyForm({
  organizationId,
  policy,
  canManage,
  labels,
}: {
  organizationId: string;
  policy: Policy;
  canManage: boolean;
  labels: Dictionary["organizationSettings"];
}) {
  const router = useRouter();
  const [approved, setApproved] = useState(policy.externalDisclosureAllowed && policy.allowedProviderModes.includes("openai"));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      await organizationsClient.updateAiProviderPolicy(organizationId, {
        openAiDisclosureApproved: approved,
        reason,
      }, policy.version);
      setReason("");
      setNotice({ tone: "success", message: labels.aiPolicySaveSuccess });
      router.refresh();
    } catch (error) {
      setNotice({
        tone: "error",
        message: localizeUiError(error, {
          fallback: labels.aiPolicySaveError,
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-background"><ShieldCheck className="h-4 w-4" /></span>
          <div>
            <CardTitle>{labels.aiPolicyTitle}</CardTitle>
            <CardDescription>{labels.aiPolicyDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {notice ? <div className={cn("rounded-md border px-4 py-3 text-sm", notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900")}>{notice.message}</div> : null}
        <div className="flex items-start gap-3 rounded-md border p-4">
          <Checkbox id="openai-disclosure" checked={approved} disabled={!canManage || saving} onCheckedChange={(value) => setApproved(value === true)} />
          <div className="grid gap-1">
            <Label htmlFor="openai-disclosure">{labels.aiPolicyOpenAiLabel}</Label>
            <p className="text-sm text-muted-foreground">{labels.aiPolicyOpenAiWarning}</p>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ai-policy-reason">{labels.aiPolicyReasonLabel}</Label>
          <Input id="ai-policy-reason" value={reason} disabled={!canManage || saving} onChange={(event) => setReason(event.target.value)} placeholder={labels.aiPolicyReasonPlaceholder} />
        </div>
        {!canManage ? <p className="text-sm text-muted-foreground">{labels.aiPolicyReadOnly}</p> : null}
        <Button className="w-fit" disabled={!canManage || saving || !reason.trim()} onClick={() => void save()}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          {saving ? labels.aiPolicySaving : labels.aiPolicySave}
        </Button>
      </CardContent>
    </Card>
  );
}
