"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      forcedTheme="dark"
      storageKey="complyx-theme"
      themes={["light", "dark"]}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
