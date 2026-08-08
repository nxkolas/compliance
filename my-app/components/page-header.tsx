import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type PageHeaderProps = HTMLAttributes<HTMLElement> & {
  title: string;
  subtitle: string;
};

export function PageHeader({
  title,
  subtitle,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3", className)} {...props}>
      <h1 className="break-words font-sans text-[28px] leading-8 font-bold tracking-normal text-foreground sm:text-[40px] sm:leading-[36px] sm:tracking-[0.396px]">
        {title}
      </h1>
      <p className="font-sans text-[18px] leading-[28px] font-normal tracking-[-0.439px] text-[#002BFF] dark:text-info-foreground">
        {subtitle}
      </p>
    </header>
  );
}
