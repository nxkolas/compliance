import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import type { CSSProperties, ReactNode } from "react";

type AppShellSkeletonProps = {
  children?: ReactNode;
};

export function AppShellSkeleton({ children }: AppShellSkeletonProps) {
  return (
    <SidebarProvider
      className="max-xl:[&>[data-slot=sidebar]]:hidden"
      style={
        {
          "--sidebar-width": "clamp(18rem, 24vw, 24rem)",
        } as CSSProperties
      }
    >
      <AppSidebarSkeleton />
      <SidebarInset className="min-w-0 bg-transparent">
        <div
          aria-hidden="true"
          className="flex h-14 shrink-0 items-center border-b border-white/10 bg-background/95 px-4 xl:hidden"
        >
          <Skeleton className="size-9 rounded-lg bg-white/15" />
        </div>
        <div className="min-w-0 flex-1 px-4 pt-5 pb-8 sm:px-6 sm:pt-7 md:px-8 md:pt-9 xl:px-[53px] xl:pt-[54px]">
          {children ?? <ProductModuleContentSkeleton />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function AppSidebarSkeleton() {
  return (
    <Sidebar
      collapsible="none"
      className="h-svh max-h-svh shrink-0 overflow-hidden border-r bg-[rgba(255,255,255,0.10)]"
    >
      <AppSidebarContentSkeleton />
    </Sidebar>
  );
}

export function AppSidebarContentSkeleton() {
  return (
    <>
      <SidebarHeader className="gap-8 px-[clamp(1.25rem,2.5vw,3rem)] pt-10 pb-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-lg bg-white/20" />
            <div className="flex flex-col gap-2 pt-1">
              <Skeleton className="h-7 w-32 bg-white/20" />
              <Skeleton className="h-4 w-40 bg-white/15" />
            </div>
          </div>
          <Skeleton className="h-10 w-full bg-white/15" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg bg-white/15" />
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SidebarGroup className="px-[clamp(1.25rem,2.5vw,3rem)]">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <SidebarSkeletonRow
                key={index}
                width={index % 2 === 0 ? "75%" : "58%"}
              />
            ))}
          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-0 pb-8">
        <SidebarGroup className="px-[clamp(1.25rem,2.5vw,3rem)]">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <SidebarSkeletonRow
                key={index}
                width={index === 2 ? "70%" : "62%"}
              />
            ))}
          </div>
        </SidebarGroup>
      </SidebarFooter>
    </>
  );
}

export function AssessmentModulePageSkeleton() {
  return (
    <AppShellSkeleton>
      <AssessmentModuleContentSkeleton />
    </AppShellSkeleton>
  );
}

export function AssessmentModuleContentSkeleton({
  showTabs = true,
}: {
  showTabs?: boolean;
} = {}) {
  return (
    <section className="flex w-full flex-col gap-6">
      {showTabs ? <TabSkeleton count={3} /> : null}
      <HeaderSkeleton />
      <Card className="rounded-lg shadow-sm">
        <CardContent className="grid gap-6 p-6 md:grid-cols-2">
          <ContentBlockSkeleton />
          <ContentBlockSkeleton />
        </CardContent>
      </Card>
    </section>
  );
}

export function GuestCheckPageSkeleton() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-24 bg-white/20" />
          <Skeleton className="h-7 w-32 rounded-full bg-white/15" />
        </header>
        <section className="flex flex-col gap-3">
          <Skeleton className="h-10 w-3/4 bg-white/20" />
          <Skeleton className="h-5 w-full max-w-2xl bg-white/15" />
          <Skeleton className="h-5 w-2/3 bg-white/15" />
        </section>
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-white/15 bg-white/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-4 w-32 bg-white/15" />
              <Skeleton className="h-4 w-12 bg-white/15" />
            </div>
            <Skeleton className="h-2 w-full bg-white/15" />
          </div>
          <div className="rounded-2xl border border-white/15 bg-[#111522]/95 p-6 sm:p-8">
            <Skeleton className="h-7 w-40 bg-white/20" />
            <Skeleton className="mt-3 h-4 w-2/3 bg-white/15" />
            <div className="mt-7 flex flex-col gap-8">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex flex-col gap-3">
                  <Skeleton className="h-5 w-3/4 bg-white/20" />
                  <Skeleton className="h-4 w-full bg-white/15" />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Skeleton className="h-11 rounded-lg bg-white/10" />
                    <Skeleton className="h-11 rounded-lg bg-white/10" />
                    <Skeleton className="h-11 rounded-lg bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function OrganizationsPageSkeleton() {
  return (
    <AppShellSkeleton>
      <div className="flex w-full flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <HeaderSkeleton />
          <Skeleton className="h-10 w-44 rounded-md" />
        </div>
        <section className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-7 w-20 rounded-md" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="rounded-lg shadow-sm">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Skeleton className="size-10 rounded-md" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Skeleton className="h-6 w-3/5" />
                      <Skeleton className="h-4 w-4/5" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-7 w-20 rounded-md" />
                    <Skeleton className="h-7 w-14 rounded-md" />
                    <Skeleton className="h-7 w-24 rounded-md" />
                  </div>
                  <Skeleton className="h-10 w-40 rounded-md" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AppShellSkeleton>
  );
}

export function AppFormPageSkeleton() {
  return (
    <AppShellSkeleton>
      <AppFormContentSkeleton />
    </AppShellSkeleton>
  );
}

export function AppFormContentSkeleton() {
  return (
    <div className="flex w-full flex-col gap-8">
      <HeaderSkeleton />
      <Card className="rounded-lg shadow-sm">
        <CardContent className="grid gap-5 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-10 w-36 rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}

export function InboxPageSkeleton() {
  return (
    <AppShellSkeleton>
      <div className="flex w-full flex-col gap-8">
        <HeaderSkeleton />
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="rounded-lg shadow-sm">
              <CardContent className="flex items-center justify-between gap-4 p-6">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-5 w-56" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="h-10 w-28 rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShellSkeleton>
  );
}

export function ProductModuleContentSkeleton() {
  return (
    <section className="flex w-full flex-col gap-8">
      <HeaderSkeleton />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-md border bg-card px-4 py-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-lg shadow-sm">
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function OrganizationModulePageSkeleton() {
  return (
    <section className="flex w-full flex-col gap-6">
      <HeaderSkeleton />
      <Card className="rounded-lg shadow-sm">
        <CardContent className="grid gap-4 p-6">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-5 w-2/3" />
        </CardContent>
      </Card>
    </section>
  );
}

export function ApplicabilityCompletedViewSkeleton() {
  return (
    <Card className="min-w-0 rounded-lg shadow-sm">
      <CardHeader className="gap-3 px-4 sm:px-6">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-40" />
      </CardHeader>
      <CardContent className="grid gap-4 px-4 sm:px-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-full max-w-2xl" />
    </div>
  );
}

function ContentBlockSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-5/6" />
      <Skeleton className="h-5 w-2/3" />
    </section>
  );
}

function TabSkeleton({ count }: { count: number }) {
  return (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-[3px]">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-7 w-40 rounded-md bg-background/70" />
      ))}
    </div>
  );
}

function SidebarSkeletonRow({ width }: { width: string }) {
  return (
    <div className="flex h-[48px] items-center gap-3 rounded-lg bg-white/10 px-3">
      <Skeleton className="size-5 shrink-0 rounded-md bg-white/20" />
      <Skeleton className="h-4 bg-white/20" style={{ width }} />
    </div>
  );
}
