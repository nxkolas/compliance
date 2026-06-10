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
      <h1 className="font-sans text-[40px] leading-[36px] font-bold tracking-[0.396px] text-[#FFFFFF]">
        {title}
      </h1>
      <p className="font-sans text-[18px] leading-[28px] font-normal tracking-[-0.439px] text-[#ADCDFB]">
        {subtitle}
      </p>
    </header>
  );
}
