import { SignUpForm } from "@/components/sign-up-form";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ assessmentId: string }>;
};

export default function GuestCreateAccountPage({ params }: PageProps) {
  return (
    <Suspense fallback={null}>
      <GuestCreateAccountContent params={params} />
    </Suspense>
  );
}

async function GuestCreateAccountContent({ params }: PageProps) {
  const { assessmentId } = await params;
  const dictionary = await getDictionary();

  return (
    <SignUpForm
      labels={dictionary.auth}
      guestAssessmentId={assessmentId}
    />
  );
}
