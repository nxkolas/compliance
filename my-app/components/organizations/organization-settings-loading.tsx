import { Skeleton } from "@/components/ui/skeleton";

export function OrganizationSettingsLoading() {
  return (
    <div className="flex w-full flex-col gap-8" aria-busy="true">
      <div className="flex h-9 w-fit items-center gap-1 rounded-lg bg-muted p-1">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-7 w-20" />
      </div>

      <section className="flex flex-col gap-2">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-5 w-[36rem] max-w-full" />
      </section>

      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-52 rounded-lg" />
        <Skeleton className="h-52 rounded-lg" />
      </div>
    </div>
  );
}
