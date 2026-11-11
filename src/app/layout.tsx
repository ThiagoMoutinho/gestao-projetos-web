import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "next-themes";

import { AppFrame } from "@/components/layout/app-frame";
import { Toaster } from "@/components/ui/sonner";
import { DEFAULT_THEME, THEME_IDS, paletteBootstrapScript } from "@/modules/appearance/appearance";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestão de Projetos",
  description: "Escritório de projetos do IGEPPS",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Script id="palette-bootstrap" strategy="beforeInteractive">
          {paletteBootstrapScript()}
        </Script>
        <ThemeProvider attribute="class" themes={[...THEME_IDS]} defaultTheme={DEFAULT_THEME} enableSystem={false}>
          <TooltipProvider>
            <AppFrame>{children}</AppFrame>
          </TooltipProvider>
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
