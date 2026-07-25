import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/lib/i18n";

export default async function OrganizationSettingsPage() {
  const dictionary = await getDictionary();
  return (
    <div className="flex w-full flex-col gap-8">
      <header className="grid gap-2">
        <h1 className="text-3xl font-bold">{dictionary.organizations.settingsTitle}</h1>
        <p className="max-w-2xl text-muted-foreground">{dictionary.organizations.settingsDescription}</p>
      </header>
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle>{dictionary.organizations.settingsMovedTitle}</CardTitle>
          <CardDescription>{dictionary.organizations.settingsMovedDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/tool/organizations">
              {dictionary.organizations.switcherManage}<ArrowRight />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
