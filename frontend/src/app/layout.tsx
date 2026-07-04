import type { Metadata, Viewport } from "next";

import { AppProviders } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Preplate",
  description: "Scheduled meals for fixed pickup locations.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#faf9f6",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
