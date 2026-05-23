import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n";
import { Suspense } from "react";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <Suspense fallback={null}>
              <SignUpSuccessContent />
            </Suspense>
          </Card>
        </div>
      </div>
    </div>
  );
}

async function SignUpSuccessContent() {
  const dictionary = await getDictionary();

  return (
    <>
      <CardHeader>
        <CardTitle className="text-2xl">
          {dictionary.auth.signupSuccessTitle}
        </CardTitle>
        <CardDescription>
          {dictionary.auth.signupSuccessDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {dictionary.auth.signupSuccessBody}
        </p>
      </CardContent>
    </>
  );
}
