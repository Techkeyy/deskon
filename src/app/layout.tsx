import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Space_Grotesk,
  JetBrains_Mono,
  Inter,
} from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Deskon — your AI closes the deal",
  description:
    "Share one link. An AI agent qualifies the lead, scopes the work, agrees a price, and settles payment on-chain. No forms, no invoices, no chasing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${inter.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
