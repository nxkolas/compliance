# Navigation Loading States

## Decision

Keep `cacheComponents: true` enabled in `next.config.ts`.

The app uses Next.js App Router streaming and Partial Prerendering. Navigation
fallbacks should therefore be intentional route-level skeletons, not blank
screens, text-only loading pages, or disappearing layout areas.

Use the `loading.tsx` file convention for route navigation fallbacks. Shared
skeleton UI lives in `components/navigation-loading.tsx`.

## Rules

- Add a `loading.tsx` file for dynamic routes that may wait on params, auth,
  dictionaries, request data, or uncached server data.
- Match the destination page layout in the loading state: same app shell,
  spacing, page header shape, tabs, and card/content areas.
- Avoid full-page manual fallbacks such as:

```tsx
<Suspense fallback={<main className="p-8">Loading...</main>}>
```

- Avoid `fallback={null}` in visible route or layout areas. If a visible region
  can suspend, use a layout-matching skeleton.
- Keep small nested Suspense boundaries for isolated async UI, such as profile
  menus or organization switchers, but give them local skeletons.
- Use `next/link` for tab and link navigation so Next can prefetch and perform
  client-side transitions.
- Do not use `Math.random()`, `Date.now()`, or other nondeterministic values in
  prerendered loading UI. Next can prerender `loading.tsx`, and nondeterminism
  can break production builds.

## Current Skeletons

Shared skeletons are exported from `components/navigation-loading.tsx`.

- `GuestCheckPageSkeleton`: guest self-check questionnaire and result pages.
- `AssessmentModulePageSkeleton`: assessment module routes and tabs.
- `AppShellSkeleton`: app pages that need sidebar plus main content chrome.
- `AppSidebarSkeleton` and `AppSidebarContentSkeleton`: sidebar-level fallbacks.
- `OrganizationsPageSkeleton`: organization list route.
- `AppFormPageSkeleton`: new organization and new assessment forms.
- `InboxPageSkeleton`: organization inbox route.
- `ProductModuleContentSkeleton`: organization dashboard/module routes.
- `OrganizationModulePageSkeleton`: organization settings/team style pages.

## Examples

Guest routes:

```tsx
// app/check/[assessmentId]/questionnaire/loading.tsx
import { GuestCheckPageSkeleton } from "@/components/navigation-loading";

export default function Loading() {
  return <GuestCheckPageSkeleton />;
}
```

Assessment routes:

```tsx
// app/tool/assessments/[assessmentId]/result/loading.tsx
import { AssessmentModulePageSkeleton } from "@/components/navigation-loading";

export default function Loading() {
  return <AssessmentModulePageSkeleton />;
}
```

Organization routes:

```tsx
// app/tool/organizations/[organizationId]/loading.tsx
import { ProductModuleContentSkeleton } from "@/components/navigation-loading";

export default function Loading() {
  return <ProductModuleContentSkeleton />;
}
```

Link-backed route tabs:

```tsx
"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function RouteTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <Tabs value={pathname}>
      <TabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.href} value={tab.href} asChild>
            <Link href={tab.href}>{tab.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
```

## Checklist For New Dynamic Routes

1. Identify the persistent shell for the route.
2. Add or reuse a skeleton that matches that shell.
3. Add `loading.tsx` beside the dynamic route segment or page.
4. Remove page-level full-screen Suspense fallbacks when `loading.tsx` owns the
   route fallback.
5. Replace visible `fallback={null}` boundaries with local skeletons.
6. Prefer `<Link href="...">` over imperative `router.push(...)` for normal
   navigation.
7. Run the verification steps below.

## Verification

Run:

```powershell
npm.cmd run build
```

Confirm the build output still says:

```text
Cache Components enabled
```

Manually test:

- Guest questionnaire to result and back.
- Assessment tabs: applicability check, questionnaire, result.
- Organization list to detail, new organization, and inbox.
- Sidebar navigation inside an organization.

Acceptance criteria:

- No blank or background-only flash.
- No standalone `Loading...` page.
- Loading state keeps the same shell and spacing as the destination route.
- Production build succeeds with Cache Components enabled.

## Official References

- [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating)
- [`loading.tsx` file convention](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [Cache Components](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- [Uncached data outside Suspense](https://nextjs.org/docs/messages/blocking-route)
