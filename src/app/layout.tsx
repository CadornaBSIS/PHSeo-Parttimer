import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

export const metadata: Metadata = {
  title: "PH SEO Parttimer | Internal Scheduling & DTR",
  description:
    "Secure internal platform for weekly scheduling, DTR capture, and manager oversight.",
  icons: {
    icon: "/PH%20SEO%20LOGO.png",
    shortcut: "/PH%20SEO%20LOGO.png",
    apple: "/PH%20SEO%20LOGO.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans bg-background text-foreground">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
