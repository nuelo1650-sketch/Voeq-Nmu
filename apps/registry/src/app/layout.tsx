import type { Metadata } from "next";
import { Playfair_Display, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Font binding — the voeq.ng production pairing (apps/web/app/fonts.ts):
// Playfair Display for display text only, Inter for UI, JetBrains Mono for code.
const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "optional",
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  display: "optional",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "optional",
  variable: "--font-jetbrains",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "NMU Business Register",
  description:
    "The official business register of the Nigeria Maritime University. One application, reviewed by a person, listed for the whole campus when approved. A Voeq service for NMU.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-env="cream">
      <body
        className={`${playfair.variable} ${inter.variable} ${jetbrains.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
