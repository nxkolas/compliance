import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";
import { PublicLanguageSwitcher } from "@/components/public-language-switcher";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const dictionary = await getDictionary();

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {authErrorMessage(params?.code, dictionary.auth)}
      </p>
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <Suspense fallback={null}>
        <PublicLanguageSwitcher />
      </Suspense>
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                <Suspense fallback={null}>
                  <ErrorTitle />
                </Suspense>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense>
                <ErrorContent searchParams={searchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function authErrorMessage(
  code: string | undefined,
  labels: Awaited<ReturnType<typeof getDictionary>>["auth"],
) {
  switch (code) {
    case "AUTH_CODE_MISSING":
      return labels.authCodeMissing;
    case "AUTH_CALLBACK_FAILED":
      return labels.authCallbackFailed;
    case "AUTH_LINK_INVALID":
      return labels.authLinkInvalid;
    default:
      return labels.unspecifiedError;
  }
}

async function ErrorTitle() {
  const dictionary = await getDictionary();

  return dictionary.auth.sorryTitle;
}
