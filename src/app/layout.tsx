import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "facebook",
  description: "Mobile-first Facebook base for the Meta young-adults hackathon",
  // iOS home-screen install: full-screen, no Safari chrome, status bar over the app.
  appleWebApp: { capable: true, title: "facebook", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
