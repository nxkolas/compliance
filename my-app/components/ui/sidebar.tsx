import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

const SidebarProvider = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    className={cn(
      "min-h-screen w-full bg-background",
      className,
    )}
    {...props}
  />
);
SidebarProvider.displayName = "SidebarProvider";

const Sidebar = React.forwardRef<HTMLElement, React.ComponentProps<"aside">>(
  ({ className, ...props }, ref) => (
    <aside
      ref={ref}
      className={cn(
        "z-20 border-b bg-background md:w-64 md:border-b-0 md:border-r",
        className,
      )}
      {...props}
    />
  ),
);
Sidebar.displayName = "Sidebar";

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex h-full flex-col gap-6 p-4", className)}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("grid gap-1", className)} {...props} />
));
SidebarHeader.displayName = "SidebarHeader";

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("grid gap-2", className)} {...props} />
));
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "px-2 text-xs font-medium text-muted-foreground",
      className,
    )}
    {...props}
  />
));
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarMenu = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"nav">
>(({ className, ...props }, ref) => (
  <nav ref={ref} className={cn("grid gap-1", className)} {...props} />
));
SidebarMenu.displayName = "SidebarMenu";

type SidebarMenuButtonProps = React.ComponentProps<"a"> & {
  asChild?: boolean;
};

const SidebarMenuButton = React.forwardRef<
  HTMLAnchorElement,
  SidebarMenuButtonProps
>(({ asChild = false, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      ref={ref}
      className={cn(
        "flex min-h-9 items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mt-auto grid gap-3", className)} {...props} />
));
SidebarFooter.displayName = "SidebarFooter";

const SidebarInset = React.forwardRef<HTMLElement, React.ComponentProps<"main">>(
  ({ className, ...props }, ref) => (
    <main
      ref={ref}
      className={cn("min-w-0 px-6 py-6 md:px-8 md:py-8", className)}
      {...props}
    />
  ),
);
SidebarInset.displayName = "SidebarInset";

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarProvider,
};
