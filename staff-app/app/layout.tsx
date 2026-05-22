import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { AuthInit } from "@/components/auth-init";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Native font stack — no network fetch at build time. Switch back to
// next/font/google when fonts.googleapis.com is reachable from your build host.
const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';

export const metadata: Metadata = {
  title: "SPRITHI Staff",
  description: "SPRITHI Digital Mart staff & admin app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={{ ["--font-sans" as string]: SYSTEM_FONT_STACK }}
      className="h-full antialiased"
    >
      <body suppressHydrationWarning className="min-h-full bg-background font-sans text-foreground">
        <ThemeProvider>
          <AuthInit />
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
