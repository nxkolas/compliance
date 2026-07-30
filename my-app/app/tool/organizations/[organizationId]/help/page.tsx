import { TutorialWelcome } from "@/components/tutorial/tutorial-welcome";
import { getDictionary } from "@/lib/i18n";

export default async function TutorialPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const dictionary = await getDictionary();

  return (
    <TutorialWelcome
      organizationId={organizationId}
      labels={dictionary.tutorial}
    />
  );
}
