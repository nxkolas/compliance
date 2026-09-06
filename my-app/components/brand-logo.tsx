import { cn } from "@/src/utils";
import Image, { type ImageProps } from "next/image";

type BrandLogoProps = Omit<ImageProps, "src">;

export function BrandLogo({ alt, className, ...props }: BrandLogoProps) {
  return (
    <>
      <Image
        src="/images/Logo-schwarz.svg"
        alt={alt}
        className={cn("dark:hidden", className)}
        {...props}
      />
      <Image
        src="/images/Logo-weiß.svg"
        alt={alt}
        className={cn("hidden dark:block", className)}
        {...props}
      />
    </>
  );
}
