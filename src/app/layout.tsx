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
      <head>
        {/* Pixel faces for the Deep Cuts game cards in Messenger */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=Silkscreen&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
