"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dictionary } from "@/src/i18n";

type SiteFooterProps = {
  labels: Dictionary["home"]["footer"];
  navigationLabel: string;
};

export function SiteFooter({ labels, navigationLabel }: SiteFooterProps) {
  const pathname = usePathname();
  const isToolPage = pathname.startsWith("/tool");
  const isPrivacyPage = pathname === "/privacy";
  const links = [
    { href: "/imprint", label: labels.imprint },
    { href: "/privacy", label: labels.privacy },
    { href: "/licenses.html", label: labels.licenses },
    { href: "/cookie", label: labels.cookie },
  ];

  return (
    <footer
      data-site-footer
      className={`w-full shrink-0 ${isPrivacyPage ? "bg-[#02040E]" : "bg-transparent"} ${isToolPage ? "xl:pl-[clamp(18rem,24vw,24rem)]" : ""}`}
    >
      <div
        aria-hidden="true"
        className="mx-auto h-px w-[calc(100%_-_3rem)] max-w-[1285.5px] bg-zinc-700 sm:w-[calc(100%_-_5rem)]"
      />
      <div className="mx-auto flex max-w-[1285.5px] flex-col items-center px-6 pt-4 pb-8 text-center text-xs text-zinc-500 sm:px-10">
        <nav
          aria-label={navigationLabel}
          className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2"
        >
          {links.map((link) => {
            const current = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={`transition-colors hover:text-zinc-300 ${current ? "font-bold text-zinc-400" : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-2">{labels.copyright}</p>
      </div>
    </footer>
  );
}
