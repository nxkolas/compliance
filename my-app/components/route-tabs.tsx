"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { usePathname } from "next/navigation";

type RouteTab = {
  href: string;
  label: string;
};

export function RouteTabs({ tabs }: { tabs: RouteTab[] }) {
  const pathname = usePathname();

  return (
    <Tabs value={pathname}>
      <TabsList className="max-w-full overflow-x-auto">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.href}
            value={tab.href}
            asChild
            className="data-[state=active]:border-input data-[state=active]:bg-input/30 data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Link href={tab.href}>{tab.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
