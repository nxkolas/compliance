"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname, useRouter } from "next/navigation";

type RouteTab = {
  href: string;
  label: string;
};

export function RouteTabs({ tabs }: { tabs: RouteTab[] }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <Tabs value={pathname} onValueChange={(href) => router.push(href)}>
      <TabsList className="max-w-full overflow-x-auto">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.href}
            value={tab.href}
            className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
