import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { getDictionary, getLocale } from "@/src/i18n";
import { serializeBrowserSupabaseEnvironment } from "@/src/config/env/supabase";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const defaultUrl = process.env.APP_PUBLIC_URL ?? "http://localhost:3000";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();

  return {
    metadataBase: new URL(defaultUrl),
    title: dictionary.metadata.title,
    description: dictionary.metadata.description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const browserConfiguration = serializeBrowserSupabaseEnvironment();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__COMPLIANCETOOL_CONFIG__=${browserConfiguration};`,
          }}
        />
      </head>
      <body className={`${spaceGrotesk.className} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
