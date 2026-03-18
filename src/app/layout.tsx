import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetBrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PH SEO Parttimer | Internal Scheduling & DTR",
  description:
    "Secure internal platform for weekly scheduling, DTR capture, and manager oversight.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${jetBrains.variable} font-sans bg-background text-foreground`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
