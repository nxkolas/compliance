import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;
  const dictionary = await getDictionary();

  return (
    <>
      {params?.error ? (
        <p className="text-sm text-muted-foreground">
          {dictionary.auth.codeError}: {params.error}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {dictionary.auth.unspecifiedError}
        </p>
      )}
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
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

async function ErrorTitle() {
  const dictionary = await getDictionary();

  return dictionary.auth.sorryTitle;
}
