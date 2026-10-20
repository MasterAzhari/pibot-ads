import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Pibot Ads", description: "Auto-post & ads for FB, IG, Threads, TikTok" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
