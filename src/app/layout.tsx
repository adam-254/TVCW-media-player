import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title:       "TVCW — Stream The World",
  description: "Stream thousands of live TV channels and TV shows for free. No subscriptions. No fees.",
  keywords:    ["TVCW", "live tv", "free streaming", "iptv", "tv shows", "watch online"],
  icons: {
    icon:             "/TVCW-logo.png",
    shortcut:         "/TVCW-logo.png",
    apple:            "/TVCW-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#00FFE7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-cyber-dark min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
